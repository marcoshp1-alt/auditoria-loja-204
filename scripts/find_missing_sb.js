
import PocketBase from 'pocketbase';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '../auditoria supabase/.env.local' });

const PB_URL = 'https://meaning-fin-arctic-consistently.trycloudflare.com/';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const pb = new PocketBase(PB_URL);
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function findMissing() {
    await pb.admins.authWithPassword('marcoshp1@gmail.com', 'auditoriaMS138hp1');

    const pbRecords = await pb.collection('audit_history').getFullList();
    const { data: sbRecords } = await supabase.from('audit_history').select('file_name, created_at, report_type');

    const sbFiles = new Set(sbRecords.map(r => r.file_name + '|' + (r.report_type || '')));

    const missing = pbRecords.filter(p => !sbFiles.has(p.fileName + '|' + (p.reportType || '')));

    console.log('Total Missing:', missing.length);
    console.log('First 5 missing files:', missing.slice(0, 5).map(m => m.fileName));

    // Mostra o registro específico que o usuário quer
    const target = missing.find(m => m.fileName.includes('tree_analise-mkvs3sls'));
    if (target) {
        console.log('Target record found in missing list!');
    }
}
findMissing();
