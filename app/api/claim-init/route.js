// =======================================================================================
// FILENAME: miniapp-frontend/app/api/claim-init/route.js (KODE TUNGGAL FINAL)
// DESKRIPSI: Menangani Frame POST, Verifikasi, Signing, dan Tx Encoding.
// =======================================================================================

import { NextResponse } from 'next/server';

// Import Viem (Dipecah untuk kompatibilitas Next.js Serverless)
import { encodeFunctionData } from 'viem'; 
import { privateKeyToAccount, signTypedData } from 'viem/accounts'; 
import { base } from 'viem/chains';

// Import Firestore
import { db } from '@/firebaseConfig';
import { collection, getDocs } from 'firebase/firestore'; 

// Import Neynar SDK v2
import { NeynarAPIClient, Configuration } from '@neynar/nodejs-sdk'; 


// --- KONFIGURASI KRITIS (Ambil dari Vercel Environment Variables) ---
const ADMIN_PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY; 
const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;
const FARCONNECT_CONTRACT_ADDRESS = '0x7d0ecbb0d5a319f5D18143E16DD5394Ad67330CD'; 

// --- INISIALISASI KLIEN GLOBAL ---
const signerAccount = ADMIN_PRIVATE_KEY ? privateKeyToAccount(ADMIN_PRIVATE_KEY) : null; 
const neynarConfig = new Configuration({ apiKey: NEYNAR_API_KEY });
const neynarClient = new NeynarAPIClient(neynarConfig);


// ABI fungsi requestClaim
const REQUEST_CLAIM_ABI = [
  {
    "inputs": [
      {"internalType":"uint256","name":"_jobId","type":"uint256"},
      {"internalType":"uint256","name":"_fid","type":"uint256"},
      {"internalType":"address","name":"_recipient","type":"address"},
      {"internalType":"uint256","name":"_amount","type":"uint256"},
      {"internalType":"string","name":"_nonce","type":"string"},
      {"internalType":"uint256","name":"_deadline","type":"uint256"},
      {"internalType":"uint256","name":"_lockDuration","type":"uint256"},
      {"internalType":"bytes","name":"_signature","type":"bytes"}
    ],
    "name": "requestClaim",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

// --- Fungsi untuk mendapatkan data Job dari Firestore ---
async function getActiveJob() {
  const jobsRef = collection(db, "active_jobs"); 
  const snapshot = await getDocs(jobsRef);
  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  const data = doc.data();
  return { 
    id: doc.id, 
    ...data,
    rewardAmountWei: data.rewardAmountWei || '0' 
  };
}


// =======================================================================================
// FUNGSI UTAMA (ENDPOINT FRAME POST)
// =======================================================================================
export async function POST(req) {
    if (!signerAccount) {
        return NextResponse.json({ message: "Konfigurasi Server Gagal: ADMIN_PRIVATE_KEY tidak ditemukan." }, { status: 500 });
    }

    let fid, recipientAddress;
    
    // 1. Ekstraksi Data dari Frame
    try {
        const body = await req.json();
        fid = body.untrustedData.fid;
        recipientAddress = body.untrustedData.address; 
        
        if (!fid || !recipientAddress) {
            return NextResponse.json({ message: "Data FID atau Wallet Address tidak ditemukan dari Frame." }, { status: 400 });
        }
    } catch (error) {
        return NextResponse.json({ message: "Gagal memproses Frame POST body." }, { status: 400 });
    }

    // 2. Ambil Data Job (Firestore)
    const activeJob = await getActiveJob();
    if (!activeJob) {
        return NextResponse.json({ message: "Tidak ada Job Aktif yang ditemukan di Firestore." }, { status: 404 });
    }

    // 3. Siapkan Payload Klaim
    const currentTimeInSeconds = Math.floor(Date.now() / 1000);
    const claimPayload = {
        jobId: activeJob.id,
        fid: fid.toString(), 
        recipientAddress: recipientAddress,
        amount: activeJob.rewardAmountWei.toString(), 
        nonce: Date.now().toString(), 
        deadline: (currentTimeInSeconds + 60).toString(), 
        lockDuration: '86400', 
    };
    
    // ------------------------------------
    // 4. VERIFIKASI ANTI-BOT (Neynar)
    // ------------------------------------
    try {
        const user = await neynarClient.fetchBulkUsers([fid], { viewer_fid: fid });
        const userData = user.users[0];

        if (!userData || userData.power_badge === false || userData.active_status !== 'active') {
             return NextResponse.json({ message: "Klaim Ditolak: Validasi anti-bot gagal. Pengguna harus aktif." }, { status: 403 });
        }
    } catch (e) {
        console.error("Kesalahan Verifikasi Neynar:", e);
        return NextResponse.json({ message: "Verifikasi Neynar Gagal." }, { status: 500 });
    }
    
    // ------------------------------------
    // 5. PENANDATANGANAN EIP-712 & ENCODE
    // ------------------------------------
    const { jobId, recipientAddress: recipient, amount, nonce, deadline, lockDuration } = claimPayload;
    
    try {
        // Data EIP-712
        const types = {
            RequestClaim: [
                { name: 'jobId', type: 'uint256' }, { name: 'fid', type: 'uint256' }, 
                { name: 'recipient', type: 'address' }, { name: 'amount', type: 'uint256' }, 
                { name: 'nonce', type: 'string' }, { name: 'deadline', type: 'uint256' }, 
                { name: 'lockDuration', type: 'uint256' },
            ],
        };

        const domain = {
            name: 'FarConnectCore', version: '7.2',
            chainId: base.id, 
            verifyingContract: FARCONNECT_CONTRACT_ADDRESS,
        };

        const value = {
            jobId: BigInt(jobId), fid: BigInt(fid), recipient: recipientAddress,
            amount: BigInt(amount), nonce: nonce, deadline: BigInt(deadline),
            lockDuration: BigInt(lockDuration),
        };
        
        // Melakukan Signing
        const signature = await signTypedData({
            account: signerAccount, domain, types, primaryType: 'RequestClaim', message: value,
        });

        // Encode Transaksi On-Chain
        const encodedData = encodeFunctionData({
            abi: REQUEST_CLAIM_ABI,
            functionName: 'requestClaim',
            args: [
                BigInt(jobId), BigInt(fid), recipientAddress, 
                BigInt(amount), nonce, BigInt(deadline), 
                BigInt(lockDuration), signature
            ],
        });

        // 6. Kembalikan Respon 'tx' ke Farcaster (Memicu Wallet)
        return NextResponse.json({
            tx: {
                chainId: `eip155:8453`, // Base Mainnet
                method: "eth_sendTransaction",
                params: {
                    abi: REQUEST_CLAIM_ABI,
                    to: FARCONNECT_CONTRACT_ADDRESS, 
                    data: encodedData, 
                }
            }
        });

    } catch (error) {
        console.error("Error selama proses signing/encoding:", error);
        return NextResponse.json({ message: "Error Internal Server saat menandatangani." }, { status: 500 });
    }
}