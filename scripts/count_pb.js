
import PocketBase from 'pocketbase';
const pb = new PocketBase('https://meaning-fin-arctic-consistently.trycloudflare.com/');
async function countPB() {
    await pb.admins.authWithPassword('marcoshp1@gmail.com', 'auditoriaMS138hp1');
    const records = await pb.collection('audit_history').getFullList();
    console.log('Total PB Records:', records.length);
}
countPB();
