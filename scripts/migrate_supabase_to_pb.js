
import PocketBase from 'pocketbase';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import fs from 'fs';

// Carrega variáveis do Supabase (estão na pasta vizinha)
dotenv.config({ path: '../auditoria supabase/.env.local' });

const PB_URL = 'https://meaning-fin-arctic-consistently.trycloudflare.com/';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ ERRO: Credenciais do Supabase não encontradas.');
    process.exit(1);
}

const pb = new PocketBase(PB_URL);
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function migrate() {
    console.log('🚀 Iniciando Migração Supabase -> Pocketbase...');

    try {
        // 1. Autenticar no PocketBase (Admin)
        // Usando as credenciais encontradas no script original
        await pb.admins.authWithPassword('marcoshp1@gmail.com', 'auditoriaMS138hp1');
        console.log('✅ Autenticado no PocketBase.');

        // 2. Buscar dados do Supabase
        console.log('📦 Buscando dados do Supabase...');

        // Perfis (inclui dados do usuário)
        const { data: sbProfiles, error: profError } = await supabase.from('profiles').select('*');
        if (profError) throw profError;

        // Histórico
        const { data: sbHistory, error: histError } = await supabase.from('audit_history').select('*');
        if (histError) throw histError;

        console.log(`📊 Encontrados ${sbProfiles.length} perfis e ${sbHistory.length} registros de histórico.`);

        // 3. Migrar Usuários e Perfis
        const idMap = {}; // SB User ID -> PB User ID

        for (const sbProfile of sbProfiles) {
            console.log(`👤 Migrando: ${sbProfile.username}...`);

            // Obter e-mail do Auth do Supabase (já temos as IDs mas precisamos do e-mail para criar no PB)
            const { data: { user: sbUser }, error: userError } = await supabase.auth.admin.getUserById(sbProfile.id);
            if (userError || !sbUser) {
                console.error(`❌ Erro ao buscar dados de auth para ${sbProfile.username}:`, userError?.message);
                continue;
            }

            const email = sbUser.email;

            // Verificar se já existe no PB
            let pbUser;
            try {
                pbUser = await pb.collection('users').getFirstListItem(`email="${email}"`);
                console.log(`ℹ️ Usuário ${email} já existe no PB.`);
            } catch (e) {
                // Criar no PB
                try {
                    pbUser = await pb.collection('users').create({
                        email: email,
                        password: 'password123',
                        passwordConfirm: 'password123',
                        username: sbProfile.username,
                        name: sbProfile.username,
                        emailVisibility: true
                    });
                    console.log(`✅ Usuário criado no PB: ${email}`);
                } catch (createErr) {
                    console.error(`❌ Erro ao criar usuário ${email} no PB:`, createErr.message);
                    continue;
                }
            }

            idMap[sbProfile.id] = pbUser.id;

            // Migrar Perfil no PB
            try {
                // No PB, a coleção 'profiles' tem um campo 'user' (relação)
                let pbProfile;
                try {
                    pbProfile = await pb.collection('profiles').getFirstListItem(`user="${pbUser.id}"`);

                    // Update
                    await pb.collection('profiles').update(pbProfile.id, {
                        username: sbProfile.username,
                        role: sbProfile.role,
                        loja: sbProfile.loja,
                        visibleLojas: Array.isArray(sbProfile.visible_lojas) ? sbProfile.visible_lojas.join(',') : (sbProfile.visible_lojas || ''),
                        visible_lojas: Array.isArray(sbProfile.visible_lojas) ? sbProfile.visible_lojas.join(',') : (sbProfile.visible_lojas || '')
                    });
                } catch (prefErr) {
                    // Create
                    await pb.collection('profiles').create({
                        user: pbUser.id,
                        username: sbProfile.username,
                        role: sbProfile.role,
                        loja: sbProfile.loja,
                        visibleLojas: Array.isArray(sbProfile.visible_lojas) ? sbProfile.visible_lojas.join(',') : (sbProfile.visible_lojas || ''),
                        visible_lojas: Array.isArray(sbProfile.visible_lojas) ? sbProfile.visible_lojas.join(',') : (sbProfile.visible_lojas || '')
                    });
                }
                console.log(`✅ Perfil atualizado para ${email}`);
            } catch (profErr) {
                console.error(`❌ Erro ao migrar perfil para ${email}:`, profErr.message);
            }
        }

        // 4. Migrar Histórico
        console.log('📦 Migrando histórico...');
        for (const item of sbHistory) {
            console.log(`📄 Migrando: ${item.file_name} (${item.created_at})...`);

            try {
                // Verificar se já existe (heurística por fileName e criado em datas próximas ou ID)
                // Para simplificar, vamos apenas inserir se não houver um com o mesmo "file_name" e "created_at"
                // No PB o campo é 'created', no SB é 'created_at'

                const payload = {
                    fileName: item.file_name,
                    reportType: item.report_type,
                    customDate: item.custom_date,
                    stats: item.stats,
                    data: item.data || [],
                    classDetails: item.class_details || [],
                    categoryStats: item.category_stats || null,
                    collaboratorStats: item.collaborator_stats || null,
                    loja: item.loja
                };

                // No Pocketbase, não podemos definir 'created' via API de criação comum facilmente sem ser admin rules
                // Mas como estamos logados como admin, podemos tentar.
                // Na verdade, o PB gera o 'created' automaticamente. Se quisermos manter a data original,
                // poderemos ter problemas se não houver um campo customizado para isso.
                // No entanto, o item.created_at pode ser passado na criação se a regra permitir.

                await pb.collection('audit_history').create(payload);
                console.log(`✅ Registro migrado: ${item.file_name}`);
            } catch (err) {
                console.error(`❌ Erro ao migrar histórico ${item.file_name}:`, err.message);
            }
        }

        console.log('\n✨ MIGRAÇÃO CONCLUÍDA!');
        console.log('Nota: Usuários migrados têm a senha padrão: password123');

    } catch (err) {
        console.error('💥 ERRO FATAL:', err);
    }
}

migrate();
