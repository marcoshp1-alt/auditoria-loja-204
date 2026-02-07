import PocketBase from 'pocketbase';

const pb = new PocketBase('https://meaning-fin-arctic-consistently.trycloudflare.com/');

async function migrate() {
    try {
        console.log('🔑 Tentando autenticar admin...');
        // Em 0.26.x, ainda deve ser .admins se for a versão antiga de admins
        // Se for a nova versão unificada, admins podem estar em uma coleção especial
        // Vamos tentar o padrão primeiro, mas com tratamento de erro

        if (!pb.admins) {
            console.log('⚠️ pb.admins não encontrado, tentando pb.authStore ou similar...');
        }

        await pb.admins.authWithPassword('marcoshp1@gmail.com', 'auditoriaMS138hp1');
        console.log('✅ Admin autenticado.');

        // 1. Tentar adicionar campo regional via update direto
        try {
            const coll = await pb.collections.getOne('profiles');
            // Nota: No v0.26+, o schema é acessível mas vamos apenas enviar o novo campo
            // O Pocketbase vai adicionar apenas se não existir se enviarmos via API de update de collection
            // Mas o SDK espera o schema completo ou parcial dependendo da versão

            console.log('📦 Atualizando schema da coleção profiles...');
            await pb.collections.update(coll.id, {
                'fields+': [
                    {
                        name: 'regional',
                        type: 'text',
                        required: false,
                        presentable: false,
                        unique: false,
                        options: { min: null, max: null, pattern: '' }
                    }
                ]
            });
            console.log('✅ Campo regional garantido via fields+ (se suportado) ou update.');
        } catch (e) {
            console.log('ℹ️ Tentativa via fields+ falhou ou campo já existe, tentando via schema tradicional...');
            const coll = await pb.collections.getOne('profiles');
            if (!coll.schema.find(f => f.name === 'regional')) {
                coll.schema.push({
                    name: 'regional',
                    type: 'text',
                    required: false,
                    options: { min: null, max: null, pattern: '' }
                });
                await pb.collections.update(coll.id, coll);
                console.log('✅ Campo regional adicionado ao schema tradicional.');
            }
        }

        // 2. Atualizar registros existentes
        const profiles = await pb.collection('profiles').getFullList();
        console.log(`🔃 Atualizando ${profiles.length} perfis para regional NE 2...`);

        for (const p of profiles) {
            if (!p.regional) {
                await pb.collection('profiles').update(p.id, { regional: 'NE 2' });
            }
        }
        console.log('✅ Todos os perfis atualizados para NE 2.');

    } catch (err) {
        console.error('❌ Erro na migração PB:', err);
    }
}

migrate();
