
import PocketBase from 'pocketbase';

const PB_URL = 'https://meaning-fin-arctic-consistently.trycloudflare.com/';
const pb = new PocketBase(PB_URL);

async function fixPB() {
    try {
        await pb.admins.authWithPassword('marcoshp1@gmail.com', 'auditoriaMS138hp1');

        // 1. Corrigir o registro específico de 26/01
        try {
            const record = await pb.collection('audit_history').getFirstListItem('fileName="tree_analise-mkvs3sls.xlsx" && (customDate="" || customDate=null)');
            await pb.collection('audit_history').update(record.id, {
                customDate: '2026-01-26'
            });
            console.log('✅ Registro 26/01 corrigido no PB.');
        } catch (e) {
            console.log('ℹ️ Registro de 26/01 não encontrado para correção ou já corrigido no PB.');
        }

        // 2. Procurar outros registros que possam precisar de ajuste
        // (Baseado no nome do arquivo que costuma ter a data)
        const all = await pb.collection('audit_history').getFullList({
            filter: 'customDate="" || customDate=null'
        });

        for (const r of all) {
            // Se o arquivo tiver algo como "29-01-2026" no nome
            const match = r.fileName.match(/(\d{2})-(\d{2})-(\d{4})/);
            if (match) {
                const newDate = `${match[3]}-${match[2]}-${match[1]}`;
                await pb.collection('audit_history').update(r.id, { customDate: newDate });
                console.log(`✅ Data auto-corrigida para ${r.fileName}: ${newDate}`);
            }
        }
    } catch (err) {
        console.error(err);
    }
}
fixPB();
