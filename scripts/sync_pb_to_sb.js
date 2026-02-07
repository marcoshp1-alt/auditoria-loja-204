
import PocketBase from 'pocketbase';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '../auditoria supabase/.env.local' });

const PB_URL = 'https://meaning-fin-arctic-consistently.trycloudflare.com/';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const pb = new PocketBase(PB_URL);
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function sync() {
    console.log('🚀 Sincronizando registros PB -> SB...');
    await pb.admins.authWithPassword('marcoshp1@gmail.com', 'auditoriaMS138hp1');

    // 1. Obter registros de ambos
    const pbRecords = await pb.collection('audit_history').getFullList();
    const { data: sbRecords } = await supabase.from('audit_history').select('file_name, report_type');
    const sbFiles = new Set(sbRecords.map(r => r.file_name + '|' + (r.report_type || '')));

    // 2. Filtrar o que falta no SB
    const missing = pbRecords.filter(p => !sbFiles.has(p.fileName + '|' + (p.reportType || '')));

    if (missing.length === 0) {
        console.log('✅ Supabase já está em dia.');
        return;
    }

    console.log(`📦 Migrando ${missing.length} registros para o Supabase...`);

    // ID do Admin no Supabase
    const ADMIN_ID = 'e42f9128-79cf-4607-93d0-2cc73487ed0c';

    for (const p of missing) {
        console.log(`📄 Migrando: ${p.fileName}...`);

        const { error } = await supabase.from('audit_history').insert({
            created_at: p.created,
            file_name: p.fileName,
            report_type: p.reportType,
            custom_date: p.customDate || null,
            stats: p.stats,
            data: p.data,
            class_details: p.classDetails,
            category_stats: p.categoryStats,
            collaborator_stats: p.collaboratorStats,
            loja: p.loja,
            user_id: ADMIN_ID // Atribuindo ao admin para visibilidade garantida
        });

        if (error) {
            console.error(`❌ Erro no arquivo ${p.fileName}:`, error.message);
        } else {
            console.log(`✅ ${p.fileName} migrado com sucesso.`);
        }
    }

    console.log('\n✨ SINCRONIZAÇÃO CONCLUÍDA!');
}
sync();
