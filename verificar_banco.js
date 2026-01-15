require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('ERRO: Variáveis de ambiente SUPABASE_URL ou SUPABASE_KEY/SERVICE_KEY não encontradas.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verificar() {
  console.log('--- Verificando Banco de Dados (Supabase) ---');
  console.log(`URL: ${supabaseUrl}`);
  
  try {
    // 1. Contagem Total
    const { count, error: countError } = await supabase
      .from('registrations')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('ERRO ao contar registros:', countError);
    } else {
      console.log(`Total de registros na tabela 'registrations': ${count}`);
    }

    // 2. Listar últimos 5 registros
    console.log('\n--- Últimos 5 registros (ordenados por data de criação) ---');
    const { data, error } = await supabase
      .from('registrations')
      .select('id, created_at, baptized_name, meeting_date')
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      console.error('ERRO ao buscar registros:', error);
    } else {
      if (data.length === 0) {
        console.log('Nenhum registro encontrado.');
      } else {
        data.forEach((row, index) => {
          console.log(`#${index + 1}:`);
          console.log(`  ID: ${row.id}`);
          console.log(`  Criado em: ${new Date(row.created_at).toLocaleString('pt-BR')}`);
          console.log(`  Batizando: ${row.baptized_name}`);
          console.log(`  Data Reunião: ${row.meeting_date}`);
          console.log('-----------------------------------');
        });
      }
    }

  } catch (e) {
    console.error('EXCEÇÃO Inesperada:', e);
  }
}

verificar();
