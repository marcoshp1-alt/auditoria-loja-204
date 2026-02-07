import PocketBase from 'pocketbase';

const PB_URL = 'https://meaning-fin-arctic-consistently.trycloudflare.com/';
const pb = new PocketBase(PB_URL);

async function fixSchema() {
    try {
        console.log('🔑 Tentando autenticar admin...');
        await pb.admins.authWithPassword('marcoshp1@gmail.com', 'auditoriaMS138hp1');
        console.log('✅ Admin autenticado.');

        const collection = await pb.collections.getOne('profiles');
        const fields = collection.fields || collection.schema || [];

        let updated = false;

        const ensureField = (name) => {
            if (!fields.find(f => f.name === name)) {
                console.log(`➕ Adicionando "${name}"...`);
                fields.push({ name, type: 'text' });
                updated = true;
            } else {
                console.log(`✅ "${name}" já existe.`);
            }
        };

        ensureField('regional');
        ensureField('visible_lojas');
        ensureField('visibleLojas');

        if (updated) {
            if (collection.fields) collection.fields = fields;
            else if (collection.schema) collection.schema = fields;

            await pb.collections.update(collection.id, collection);
            console.log('✨ Esquema atualizado!');
        } else {
            console.log('🙌 Tudo pronto.');
        }

    } catch (err) {
        console.error('❌ Erro:', err.message);
    }
}

fixSchema();
