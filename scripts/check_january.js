
import PocketBase from 'pocketbase';

const PB_URL = 'https://meaning-fin-arctic-consistently.trycloudflare.com/';
const pb = new PocketBase(PB_URL);

async function checkPB() {
    try {
        await pb.admins.authWithPassword('marcoshp1@gmail.com', 'auditoriaMS138hp1');
        const records = await pb.collection('audit_history').getFullList({
            filter: '(customDate >= "2026-01-20" && customDate <= "2026-02-01") || (created >= "2026-01-20" && created <= "2026-02-01")',
            sort: '-created'
        });
        console.log('--- PB RECORDS ---');
        console.log(JSON.stringify(records.map(r => ({ id: r.id, file: r.fileName, date: r.customDate, created: r.created })), null, 2));
    } catch (err) {
        console.error(err);
    }
}
checkPB();
