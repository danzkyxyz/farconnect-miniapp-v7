// miniapp-frontend/app/page.tsx

import { Metadata } from 'next';
import { db } from '@/firebaseConfig'; 
import { collection, getDocs, DocumentData } from 'firebase/firestore';

// HOSTNAME: URL Publik Vercel Anda setelah deployment!
const HOSTNAME = "https://farconnect-miniapp.vercel.app"; // Ganti ini setelah deploy!

// Alamat di mana Frame akan POST saat tombol ditekan.
const SIGNING_API_ROUTE = `/api/claim-init`; 

// =======================================================================================
// INTERFACE UNTUK DATA JOB
// =======================================================================================
interface JobData {
    id: string;
    reward: number; 
    token: string;
    jobType: string; 
    rewardAmountWei: string; 
}

// =======================================================================================
// Fungsi Server-Side untuk Memuat Data dari Firestore
// =======================================================================================
async function getActiveJobs(): Promise<JobData[]> {
  let jobData: JobData[] = [];
  try {
    const jobsRef = collection(db, "active_jobs"); 
    const snapshot = await getDocs(jobsRef);
    
    snapshot.forEach(doc => {
      const data = doc.data() as DocumentData;
      jobData.push({ 
        id: doc.id, 
        reward: data.reward,
        token: data.token,
        jobType: data.jobType,
        rewardAmountWei: data.rewardAmountWei || '0', 
      });
    });

  } catch (e) {
    console.error("Gagal memuat data dari Firestore:", e);
    return [];
  }
  return jobData;
}

// =======================================================================================
// NEXT.JS METADATA (DIBACA OLEH FARCASTER)
// =======================================================================================
export async function generateMetadata(): Promise<Metadata> {
  const jobData = await getActiveJobs();
  const activeJob = jobData.length > 0 ? jobData[0] : null;
  const jobId = activeJob ? activeJob.id : "TBA";
  const postUrl = `${HOSTNAME}${SIGNING_API_ROUTE}`;
  
  const frameMetadata = activeJob ? {
    'fc:frame:button:1': `Klaim Job #${jobId}: ${activeJob.reward} ${activeJob.token}`,
    'fc:frame:button:1:action': 'post',
    'fc:frame:post_url': postUrl,
  } : {
    'fc:frame:button:1': "Tidak ada Job Aktif"
  };

  return {
    title: 'FARCONNECT V7.2',
    other: {
      'fc:frame': 'vNext',
      'fc:frame:image': `${HOSTNAME}/cover.png`,
      ...frameMetadata,
    },
  };
}

// =======================================================================================
// KOMPONEN HALAMAN UTAMA
// =======================================================================================
export default async function Home() {
  const jobData = await getActiveJobs();
  const activeJob = jobData.length > 0 ? jobData[0] : null;

  return (
    <main style={{ padding: '20px', textAlign: 'center' }}>
      <h1>FARCONNECT V7.2 - Job Status</h1>
      {activeJob ? (
        <p>Job Aktif Ditemukan: **{activeJob.jobType}** - Reward: {activeJob.reward} {activeJob.token}</p>
      ) : (
        <p>Memuat Job dari Firestore / Job tidak ditemukan.</p>
      )}
      <p>Endpoint Signer: POST {HOSTNAME}{SIGNING_API_ROUTE}</p>
    </main>
  );
}