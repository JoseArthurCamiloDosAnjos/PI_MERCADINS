const { conectar } = require('../db/neon')
const { enviarEmailPromocaoAdmin } = require('../utils/mailer')

// ─── Helper — gerar email admin personalizado ──────────────────────────────

function gerarEmailAdmin(nome) {
  const slug = nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z\s]/g, '')
    .trim()
    .replace(/\s+/g, '.')
    .replace(/\.+/g, '.')
  return `${slug}.adim@mercadins.com`
}

// ─── Dashboard ──────────────────────────────────────────────────────────────

async function dashboard(_req, res) {
  try {
    const sql = await conectar()

    const [totalMercados]    = await sql`SELECT COUNT(*)::int AS total FROM mercados`
    const [totalUsuarios]    = await sql`SELECT COUNT(*)::int AS total FROM usuarios`
    const [totalProdutos]    = await sql`SELECT COUNT(*)::int AS total FROM produtos`
    const [totalPedidos]     = await sql`SELECT COUNT(*)::int AS total FROM historico_compras`
    const [mercadosAtivos]   = await sql`
      SELECT COUNT(DISTINCT id_mercado)::int AS total
      FROM usuarios_mercados WHERE papel IN ('dono','admin')
    `
    const [totalEntregadores] = await sql`
      SELECT COUNT(*)::int AS total
      FROM usuarios_mercados WHERE papel = 'funcionario'
    `

    // Crescimento mensal — últimos 6 meses
    const crescimentoMercados = await sql`
      SELECT
        TO_CHAR(DATE_TRUNC('month', data_cadastro), 'YYYY-MM') AS mes,
        COUNT(*)::int AS total
      FROM mercados
      WHERE data_cadastro >= NOW() - INTERVAL '6 months'
      GROUP BY mes ORDER BY mes
    `

    const crescimentoUsuarios = await sql`
      SELECT
        TO_CHAR(DATE_TRUNC('month', data_cadastro), 'YYYY-MM') AS mes,
        COUNT(*)::int AS total
      FROM usuarios
      WHERE data_cadastro >= NOW() - INTERVAL '6 months'
      GROUP BY mes ORDER BY mes
    `

    // Atividade recente — últimos registros de mercados e usuários
    const mercadosRecentes = await sql`
      SELECT nome, data_cadastro AS data FROM mercados
      ORDER BY data_cadastro DESC LIMIT 5
    `
    const usuariosRecentes = await sql`
      SELECT nome, data_cadastro AS data FROM usuarios
      ORDER BY data_cadastro DESC LIMIT 5
    `
    const avaliacoesRecentes = await sql`
      SELECT u.nome, a.nota, a.data_cadastro AS data
      FROM avaliacoes a JOIN usuarios u ON u.id_usuario = a.id_usuario
      ORDER BY a.data_cadastro DESC LIMIT 5
    `

    const atividade = [
      ...mercadosRecentes.map(m => ({
        descricao: `Novo mercado cadastrado: ${m.nome}`,
        tipo: 'mercado',
        data: m.data,
      })),
      ...usuariosRecentes.map(u => ({
        descricao: `Novo usuário: ${u.nome}`,
        tipo: 'usuario',
        data: u.data,
      })),
      ...avaliacoesRecentes.map(a => ({
        descricao: `${a.nome} deixou uma avaliação (${a.nota} estrelas)`,
        tipo: 'avaliacao',
        data: a.data,
      })),
    ]
      .sort((a, b) => new Date(b.data) - new Date(a.data))
      .slice(0, 10)

    res.json({
      metricas: {
        totalMercados: totalMercados.total,
        totalUsuarios: totalUsuarios.total,
        totalProdutos: totalProdutos.total,
        totalPedidos: totalPedidos.total,
        mercadosAtivos: mercadosAtivos.total,
        totalEntregadores: totalEntregadores.total,
      },
      crescimentoMercados: formatarMeses(crescimentoMercados),
      crescimentoUsuarios: formatarMeses(crescimentoUsuarios),
      atividade,
    })
  } catch (err) {
    console.error('Erro no dashboard admin:', err.message)
    res.status(500).json({ erro: 'Erro ao carregar dashboard' })
  }
}

// ─── Listar Usuários ────────────────────────────────────────────────────────

async function listarUsuarios(req, res) {
  try {
    const sql = await conectar()
    const { busca = '', tipo = '', status = '', pagina = 1, limite = 20 } = req.query

    const paginaNum = Math.max(1, Number(pagina) || 1)
    const limiteNum = Math.min(100, Math.max(1, Number(limite) || 20))
    const offset = (paginaNum - 1) * limiteNum

    // Texto da busca em minúsculas (a comparação usa LOWER + LIKE)
    const textoBusca = String(busca).trim()
    const buscaLower = `%${textoBusca.toLowerCase()}%`
    const tipoFiltro = ['admin', 'vendedor', 'cliente'].includes(tipo) ? tipo : ''
    const statusFiltro = ['ativo', 'inativo', 'bloqueado'].includes(status) ? status : ''

    // Todos os filtros entraram na consulta (antes o filtro de status que a
    // tela enviava era ignorado e a paginação contava todo mundo).
    // As condições são fixas e os valores vão como parâmetro — o banco do
    // projeto não aceita montar SQL dinâmico colando texto.
    const usuarios = await sql`
      SELECT
        u.id_usuario, u.nome, u.email, u.telefone, u.data_cadastro, u.foto_perfil, u.is_admin, u.status, u.ultimo_acesso,
        COALESCE(
          (SELECT papel FROM usuarios_mercados WHERE id_usuario = u.id_usuario LIMIT 1),
          'cliente'
        ) AS papel,
        EXISTS(SELECT 1 FROM usuarios_mercados WHERE id_usuario = u.id_usuario AND papel IN ('dono','admin')) AS is_vendedor
      FROM usuarios u
      WHERE (${textoBusca}::text = ''
            OR LOWER(u.nome) LIKE ${buscaLower}
            OR LOWER(u.email) LIKE ${buscaLower})
        AND (
          ${tipoFiltro}::text = ''
          OR (${tipoFiltro} = 'admin' AND u.is_admin = TRUE)
          OR (${tipoFiltro} = 'vendedor' AND u.id_usuario IN (
                SELECT id_usuario FROM usuarios_mercados WHERE papel IN ('dono','admin')))
          OR (${tipoFiltro} = 'cliente' AND u.is_admin = FALSE AND u.id_usuario NOT IN (
                SELECT id_usuario FROM usuarios_mercados WHERE papel IN ('dono','admin')))
        )
        AND (${statusFiltro}::text = '' OR COALESCE(u.status, 'ativo') = ${statusFiltro})
      ORDER BY u.data_cadastro DESC
      LIMIT ${limiteNum} OFFSET ${offset}
    `

    const [contFiltrados] = await sql`
      SELECT COUNT(*)::int AS total FROM usuarios u
      WHERE (${textoBusca}::text = ''
            OR LOWER(u.nome) LIKE ${buscaLower}
            OR LOWER(u.email) LIKE ${buscaLower})
        AND (
          ${tipoFiltro}::text = ''
          OR (${tipoFiltro} = 'admin' AND u.is_admin = TRUE)
          OR (${tipoFiltro} = 'vendedor' AND u.id_usuario IN (
                SELECT id_usuario FROM usuarios_mercados WHERE papel IN ('dono','admin')))
          OR (${tipoFiltro} = 'cliente' AND u.is_admin = FALSE AND u.id_usuario NOT IN (
                SELECT id_usuario FROM usuarios_mercados WHERE papel IN ('dono','admin')))
        )
        AND (${statusFiltro}::text = '' OR COALESCE(u.status, 'ativo') = ${statusFiltro})
    `

    // Métricas dos cartões: sempre do sistema inteiro (não mudam com o filtro)
    const [contTotal]  = await sql`SELECT COUNT(*)::int AS total FROM usuarios`
    const [contAdmin]  = await sql`SELECT COUNT(*)::int AS total FROM usuarios WHERE is_admin = TRUE`
    const [contVend]   = await sql`SELECT COUNT(*)::int AS total FROM usuarios WHERE id_usuario IN (SELECT id_usuario FROM usuarios_mercados WHERE papel IN ('dono','admin'))`

    res.json({
      usuarios,
      metricas: {
        total: contTotal.total,
        administradores: contAdmin.total,
        vendedores: contVend.total,
        clientes: contTotal.total - contVend.total - contAdmin.total,
      },
      paginacao: {
        pagina: paginaNum,
        limite: limiteNum,
        total: contFiltrados.total,
        totalPaginas: Math.max(1, Math.ceil(contFiltrados.total / limiteNum)),
      },
    })
  } catch (err) {
    console.error('Erro ao listar usuarios admin:', err.message)
    res.status(500).json({ erro: 'Erro ao listar usuários' })
  }
}

// ─── Relatórios ─────────────────────────────────────────────────────────────

async function relatorios(req, res) {
  try {
    const sql = await conectar()
    const { periodo = 'tudo', data_inicio } = req.query

    // Período escolhido na tela (dia, mês ou ano) → [início, fim[
    // Sem período (ou valor fora do padrão) fica null e nada é filtrado.
    const pad = n => String(n).padStart(2, '0')
    const fmt = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} 00:00:00`
    const valor = typeof data_inicio === 'string' ? data_inicio.trim() : ''

    let inicio = null
    let fim = null
    if (periodo === 'dia' && /^\d{4}-\d{2}-\d{2}$/.test(valor)) {
      const [a, m, d] = valor.split('-').map(Number)
      inicio = fmt(new Date(a, m - 1, d))
      fim = fmt(new Date(a, m - 1, d + 1))
    } else if (periodo === 'mes' && /^\d{4}-\d{2}$/.test(valor)) {
      const [a, m] = valor.split('-').map(Number)
      inicio = fmt(new Date(a, m - 1, 1))
      fim = fmt(new Date(a, m, 1))
    } else if (periodo === 'ano' && /^\d{4}$/.test(valor)) {
      const a = Number(valor)
      inicio = fmt(new Date(a, 0, 1))
      fim = fmt(new Date(a + 1, 0, 1))
    }

    // Cada bloco repete a mesma janela de datas: a camada de banco só aceita
    // valor como parâmetro, então o texto do SQL não pode ser montado em código.

    // Métricas gerais
    const [totalMercados]  = await sql`SELECT COUNT(*)::int AS total FROM mercados`
    const [totalPedidos]   = await sql`SELECT COUNT(*)::int AS total FROM historico_compras`
    const [pedidosMes]     = await sql`
      SELECT COUNT(*)::int AS total FROM historico_compras
      WHERE data_compra >= DATE_TRUNC('month', NOW())
    `
    const [entregasConcluidas] = await sql`
      SELECT COUNT(*)::int AS total FROM historico_compras
      WHERE status = 'entregue'
        AND (${inicio}::text IS NULL
             OR (data_compra >= ${inicio}::timestamp AND data_compra < ${fim}::timestamp))
    `
    const [receitaTotal] = await sql`
      SELECT COALESCE(SUM(valor_total), 0)::numeric AS total FROM historico_compras
      WHERE (${inicio}::text IS NULL
             OR (data_compra >= ${inicio}::timestamp AND data_compra < ${fim}::timestamp))
    `

    // Pedidos por período (últimos 6 meses, ou só o período escolhido)
    const pedidosPorPeriodo = await sql`
      SELECT
        TO_CHAR(DATE_TRUNC('month', data_compra), 'YYYY-MM') AS mes,
        COUNT(*)::int AS total
      FROM historico_compras
      WHERE (
        ${inicio}::text IS NULL
        AND data_compra >= NOW() - INTERVAL '6 months'
      ) OR (
        ${inicio}::text IS NOT NULL
        AND data_compra >= ${inicio}::timestamp
        AND data_compra < ${fim}::timestamp
      )
      GROUP BY mes ORDER BY mes
    `

    // Mercados por tipo (paleta)
    const mercadosPorTipo = await sql`
      SELECT COALESCE(paleta, 'classico') AS tipo, COUNT(*)::int AS total
      FROM mercados
      GROUP BY tipo ORDER BY total DESC
    `

    // Entregas por tipo (status)
    const entregasPorTipo = await sql`
      SELECT status, COUNT(*)::int AS total
      FROM historico_compras
      WHERE (${inicio}::text IS NULL
             OR (data_compra >= ${inicio}::timestamp AND data_compra < ${fim}::timestamp))
      GROUP BY status ORDER BY total DESC
    `

    res.json({
      metricas: {
        totalMercados: totalMercados.total,
        pedidosConcluidos: entregasConcluidas.total,
        pedidosMes: pedidosMes.total,
        entregasConcluidas: entregasConcluidas.total,
        receitaTotal: Number(receitaTotal.total),
      },
      pedidosPorPeriodo: formatarMeses(pedidosPorPeriodo),
      mercadosPorTipo,
      entregasPorTipo,
    })
  } catch (err) {
    console.error('Erro nos relatórios admin:', err.message)
    res.status(500).json({ erro: 'Erro ao carregar relatórios' })
  }
}

// ─── Atividade Recente ──────────────────────────────────────────────────────

async function atividadeRecente(_req, res) {
  try {
    const sql = await conectar()

    const mercados = await sql`
      SELECT nome, data_cadastro AS data FROM mercados
      ORDER BY data_cadastro DESC LIMIT 10
    `
    const usuarios = await sql`
      SELECT nome, data_cadastro AS data FROM usuarios
      ORDER BY data_cadastro DESC LIMIT 10
    `
    const avaliacoes = await sql`
      SELECT u.nome, a.nota, a.data_cadastro AS data
      FROM avaliacoes a JOIN usuarios u ON u.id_usuario = a.id_usuario
      ORDER BY a.data_cadastro DESC LIMIT 10
    `
    const pedidos = await sql`
      SELECT h.produtos, h.valor_total, h.data_compra AS data, u.nome
      FROM historico_compras h JOIN usuarios u ON u.id_usuario = h.id_usuario
      ORDER BY h.data_compra DESC LIMIT 10
    `

    const atividade = [
      ...mercados.map(m => ({
        descricao: `Novo mercado cadastrado: ${m.nome}`,
        tipo: 'mercado',
        data: m.data,
      })),
      ...usuarios.map(u => ({
        descricao: `Novo usuário: ${u.nome}`,
        tipo: 'usuario',
        data: u.data,
      })),
      ...avaliacoes.map(a => ({
        descricao: `${a.nome} avaliou (${a.nota}★)`,
        tipo: 'avaliacao',
        data: a.data,
      })),
      ...pedidos.map(p => ({
        descricao: `${p.nome} realizou pedido (R$ ${Number(p.valor_total).toFixed(2)})`,
        tipo: 'pedido',
        data: p.data,
      })),
    ]
      .sort((a, b) => new Date(b.data) - new Date(a.data))
      .slice(0, 20)

    res.json({ atividade })
  } catch (err) {
    console.error('Erro na atividade admin:', err.message)
    res.status(500).json({ erro: 'Erro ao carregar atividade' })
  }
}

// ─── Alertas ────────────────────────────────────────────────────────────────

async function alertas(_req, res) {
  try {
    const sql = await conectar()

    const alertas = []

    // Mercados sem produtos
    const [mercadosSemProdutos] = await sql`
      SELECT COUNT(*)::int AS total FROM mercados m
      WHERE NOT EXISTS (
        SELECT 1 FROM categorias c
        JOIN produtos p ON p.id_categoria = c.id_categoria
        WHERE c.id_mercado = m.id_mercado
      )
    `
    if (mercadosSemProdutos.total > 0) {
      alertas.push({
        titulo: 'Mercados sem produtos',
        descricao: `${mercadosSemProdutos.total} mercado(s) não possuem produtos cadastrados`,
        tipo: 'aviso',
        data: new Date(),
      })
    }

    // Usuários sem email verificado
    const [semVerificacao] = await sql`
      SELECT COUNT(*)::int AS total FROM usuarios
      WHERE email_verificado = FALSE
    `
    if (semVerificacao.total > 0) {
      alertas.push({
        titulo: 'Emails não verificados',
        descricao: `${semVerificacao.total} usuário(s) ainda não verificaram o email`,
        tipo: 'info',
        data: new Date(),
      })
    }

    // Avaliações baixas
    const [avaliacoesBaixas] = await sql`
      SELECT COUNT(*)::int AS total FROM avaliacoes WHERE nota <= 2
    `
    if (avaliacoesBaixas.total > 0) {
      alertas.push({
        titulo: 'Avaliações baixas',
        descricao: `${avaliacoesBaixas.total} avaliação(ões) com nota 2 ou menor`,
        tipo: 'critico',
        data: new Date(),
      })
    }

    // Total de mercados e usuários
    const [totalMercados] = await sql`SELECT COUNT(*)::int AS total FROM mercados`
    const [totalUsuarios] = await sql`SELECT COUNT(*)::int AS total FROM usuarios`

    alertas.push({
      titulo: 'Resumo do sistema',
      descricao: `${totalMercados.total} mercados e ${totalUsuarios.total} usuários registrados`,
      tipo: 'sucesso',
      data: new Date(),
    })

    res.json({ alertas })
  } catch (err) {
    console.error('Nos alertas admin:', err.message)
    res.status(500).json({ erro: 'Erro ao carregar alertas' })
  }
}

// ─── Detalhes do Usuário ────────────────────────────────────────────────────

async function detalhesUsuario(req, res) {
  try {
    const sql = await conectar()
    const { id } = req.params

    const [usuario] = await sql`
      SELECT id_usuario, nome, email, cpf, telefone, data_nascimento, data_cadastro, foto_perfil, is_admin, status, email_verificado, email_admin
      FROM usuarios WHERE id_usuario = ${Number(id)}
    `
    if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado' })

    // Mercados vinculados
    const mercados = await sql`
      SELECT m.id_mercado, m.nome, m.slug, m.cidade, m.estado, m.status, um.papel,
        (SELECT COUNT(*)::int FROM historico_compras WHERE id_mercado = m.id_mercado) AS total_pedidos
      FROM usuarios_mercados um
      JOIN mercados m ON m.id_mercado = um.id_mercado
      WHERE um.id_usuario = ${Number(id)}
    `

    // Histórico de atividades
    const atividades = []

    const mercadosCad = await sql`
      SELECT m.nome, m.data_cadastro AS data FROM mercados m
      JOIN usuarios_mercados um ON um.id_mercado = m.id_mercado
      WHERE um.id_usuario = ${Number(id)} AND um.papel = 'dono'
      ORDER BY m.data_cadastro DESC LIMIT 5
    `
    mercadosCad.forEach(m => {
      atividades.push({ descricao: `Cadastrou o mercado "${m.nome}"`, data: m.data, tipo: 'mercado' })
    })

    const historico = await sql`
      SELECT h.produtos, h.valor_total, h.data_compra, h.status, m.nome AS mercado_nome
      FROM historico_compras h
      JOIN mercados m ON m.id_mercado = h.id_mercado
      WHERE h.id_usuario = ${Number(id)}
      ORDER BY h.data_compra DESC LIMIT 5
    `
    historico.forEach(h => {
      atividades.push({
        descricao: `Comprou em "${h.mercado_nome}" (R$ ${Number(h.valor_total).toFixed(2)})`,
        data: h.data_compra,
        tipo: 'compra',
      })
    })

    const avaliacoes = await sql`
      SELECT a.nota, a.texto, a.data_cadastro, m.nome AS mercado_nome
      FROM avaliacoes a
      JOIN mercados m ON m.id_mercado = a.id_mercado
      WHERE a.id_usuario = ${Number(id)}
      ORDER BY a.data_cadastro DESC LIMIT 5
    `
    avaliacoes.forEach(a => {
      atividades.push({
        descricao: `Avaliou "${a.mercado_nome}" (${a.nota}★)`,
        data: a.data_cadastro,
        tipo: 'avaliacao',
      })
    })

    atividades.sort((a, b) => new Date(b.data) - new Date(a.data))

    res.json({
      usuario,
      mercados,
      atividades: atividades.slice(0, 10),
    })
  } catch (err) {
    console.error('Erro nos detalhes do usuário:', err.message)
    res.status(500).json({ erro: 'Erro ao buscar detalhes do usuário' })
  }
}

// ─── Editar Usuário ─────────────────────────────────────────────────────────

async function editarUsuario(req, res) {
  try {
    const sql = await conectar()
    const { id } = req.params
    const { nome, email, telefone, is_admin, status } = req.body

    const [existe] = await sql`SELECT id_usuario, is_admin, nome FROM usuarios WHERE id_usuario = ${Number(id)}`
    if (!existe) return res.status(404).json({ erro: 'Usuário não encontrado' })

    // Verificar se email já pertence a outro usuário
    if (email) {
      const [emailExistente] = await sql`
        SELECT id_usuario FROM usuarios WHERE email = ${email} AND id_usuario != ${Number(id)}
      `
      if (emailExistente) return res.status(400).json({ erro: 'Este email já está em uso por outro usuário' })
    }

    // Gerar email admin ao promover a admin
    let emailAdmin = undefined
    if (is_admin === true && !existe.is_admin) {
      emailAdmin = gerarEmailAdmin(nome || existe.nome)
    }

    if (emailAdmin !== undefined) {
      await sql`
        UPDATE usuarios SET
          nome = COALESCE(${nome ?? null}, nome),
          email = COALESCE(${email ?? null}, email),
          telefone = COALESCE(${telefone ?? null}, telefone),
          is_admin = COALESCE(${is_admin ?? null}, is_admin),
          status = COALESCE(${status ?? null}, status),
          email_admin = ${emailAdmin}
        WHERE id_usuario = ${Number(id)}
      `
    } else {
      await sql`
        UPDATE usuarios SET
          nome = COALESCE(${nome ?? null}, nome),
          email = COALESCE(${email ?? null}, email),
          telefone = COALESCE(${telefone ?? null}, telefone),
          is_admin = COALESCE(${is_admin ?? null}, is_admin),
          status = COALESCE(${status ?? null}, status)
        WHERE id_usuario = ${Number(id)}
      `
    }

    const [atualizado] = await sql`
      SELECT id_usuario, nome, email, telefone, is_admin, status, email_admin
      FROM usuarios WHERE id_usuario = ${Number(id)}
    `

    // Promoção: avisa no e-mail PESSOAL da pessoa o login administrativo e a
    // senha (a mesma da conta normal). Se o provedor falhar, a promoção já
    // está salva — só informamos que o e-mail não saiu.
    let emailEnviado = false
    if (is_admin === true && !existe.is_admin) {
      try {
        await enviarEmailPromocaoAdmin(atualizado.email, atualizado.nome, atualizado.email_admin)
        emailEnviado = true
        console.log(`E-mail de promoção a admin enviado para ${atualizado.email}`)
      } catch (err) {
        console.error('Falha ao enviar e-mail de promoção a admin:', err.message)
      }
    }

    res.json({ usuario: atualizado, email_enviado: emailEnviado })
  } catch (err) {
    console.error('Erro ao editar usuário:', err.message)
    res.status(500).json({ erro: 'Erro ao editar usuário' })
  }
}

// ─── Bloquear/Desbloquear Usuário ───────────────────────────────────────────

async function bloquearUsuario(req, res) {
  try {
    const sql = await conectar()
    const { id } = req.params

    const [usuario] = await sql`SELECT id_usuario, status FROM usuarios WHERE id_usuario = ${Number(id)}`
    if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado' })

    const novoStatus = usuario.status === 'bloqueado' ? 'ativo' : 'bloqueado'
    await sql`UPDATE usuarios SET status = ${novoStatus} WHERE id_usuario = ${Number(id)}`

    res.json({ mensagem: `Usuário ${novoStatus === 'bloqueado' ? 'bloqueado' : 'desbloqueado'} com sucesso`, status: novoStatus })
  } catch (err) {
    console.error('Erro ao bloquear usuário:', err.message)
    res.status(500).json({ erro: 'Erro ao bloquear usuário' })
  }
}

// ─── Ativar/Desativar Usuário ───────────────────────────────────────────────

async function statusUsuario(req, res) {
  try {
    const sql = await conectar()
    const { id } = req.params
    const { status } = req.body

    if (!['ativo', 'inativo', 'bloqueado'].includes(status)) {
      return res.status(400).json({ erro: 'Status inválido' })
    }

    const [usuario] = await sql`SELECT id_usuario FROM usuarios WHERE id_usuario = ${Number(id)}`
    if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado' })

    await sql`UPDATE usuarios SET status = ${status} WHERE id_usuario = ${Number(id)}`

    res.json({ mensagem: `Status alterado para ${status}` })
  } catch (err) {
    console.error('Erro ao alterar status:', err.message)
    res.status(500).json({ erro: 'Erro ao alterar status do usuário' })
  }
}

// ─── Excluir Usuário ────────────────────────────────────────────────────────

async function excluirUsuario(req, res) {
  try {
    const sql = await conectar()
    const { id } = req.params

    const [usuario] = await sql`SELECT id_usuario, is_admin FROM usuarios WHERE id_usuario = ${Number(id)}`
    if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado' })

    if (usuario.is_admin) {
      const [contAdmins] = await sql`SELECT COUNT(*)::int AS total FROM usuarios WHERE is_admin = TRUE`
      if (contAdmins.total <= 1) {
        return res.status(400).json({ erro: 'Não é possível excluir o único administrador do sistema' })
      }
    }

    // Desvincular de mercados primeiro
    await sql`DELETE FROM usuarios_mercados WHERE id_usuario = ${Number(id)}`

    // Excluir usuário (cascade deve cuidar de favoritos, avaliações, carrinho)
    await sql`DELETE FROM usuarios WHERE id_usuario = ${Number(id)}`

    res.json({ mensagem: 'Usuário excluído com sucesso' })
  } catch (err) {
    console.error('Erro ao excluir usuário:', err.message)
    res.status(500).json({ erro: 'Erro ao excluir usuário' })
  }
}

// ─── Mercados (visão do administrador) ──────────────────────────────────────
// Aba "Mercados" do painel: lista todas as lojas da plataforma (inclusive as
// bloqueadas), com busca, filtro de status e contagem de produtos/cupons.
// Também serve para entender por que uma loja não aparece no site público.

async function listarMercadosAdmin(req, res) {
  try {
    const sql = await conectar()
    const { busca = '', status = '' } = req.query

    const texto = String(busca).trim()
    const buscaLower = `%${texto.toLowerCase()}%`
    const statusFiltro = ['ativo', 'bloqueado', 'suspenso'].includes(status) ? status : ''

    const mercados = await sql`
      SELECT
        m.id_mercado, m.nome, m.slug, m.cidade, m.estado, m.status, m.plano,
        m.cnpj, m.email, m.telefone, m.data_cadastro, m.pedido_minimo, m.taxa_entrega,
        m.categorias, m.oferece_entrega, m.oferece_retirada,
        (SELECT COUNT(*)::int FROM categorias c WHERE c.id_mercado = m.id_mercado) AS total_categorias,
        (SELECT COUNT(*)::int FROM produtos p
           JOIN categorias c ON c.id_categoria = p.id_categoria
          WHERE c.id_mercado = m.id_mercado) AS total_produtos,
        (SELECT COUNT(*)::int FROM cupons cp WHERE cp.id_mercado = m.id_mercado) AS total_cupons,
        (SELECT COUNT(*)::int FROM cupons cp WHERE cp.id_mercado = m.id_mercado AND cp.ativo) AS total_cupons_ativos,
        (SELECT COUNT(*)::int FROM historico_compras h WHERE h.id_mercado = m.id_mercado) AS total_pedidos,
        (SELECT u.nome FROM usuarios_mercados um
           JOIN usuarios u ON u.id_usuario = um.id_usuario
          WHERE um.id_mercado = m.id_mercado AND um.papel = 'dono'
          LIMIT 1) AS dono
      FROM mercados m
      WHERE (${texto}::text = ''
            OR LOWER(m.nome) LIKE ${buscaLower}
            OR LOWER(COALESCE(m.slug, '')) LIKE ${buscaLower}
            OR LOWER(COALESCE(m.cidade, '')) LIKE ${buscaLower}
            OR LOWER(COALESCE(m.cnpj, '')) LIKE ${buscaLower})
        AND (${statusFiltro}::text = '' OR m.status = ${statusFiltro})
      ORDER BY
        CASE WHEN m.status = 'ativo' THEN 0 ELSE 1 END,
        m.data_cadastro DESC,
        m.nome ASC
      LIMIT 500
    `

    const [{ total }] = await sql`SELECT COUNT(*)::int AS total FROM mercados`
    const [{ ativos }] = await sql`SELECT COUNT(*)::int AS ativos FROM mercados WHERE status = 'ativo'`
    const [{ bloqueados }] = await sql`SELECT COUNT(*)::int AS bloqueados FROM mercados WHERE status <> 'ativo'`

    res.json({
      mercados,
      metricas: { total, ativos, bloqueados },
    })
  } catch (err) {
    console.error('Erro ao listar mercados admin:', err.message)
    res.status(500).json({ erro: 'Erro ao listar mercados' })
  }
}

// GET /api/admin/mercados/:id — o que o administrador precisa ver de uma loja
async function detalheMercadoAdmin(req, res) {
  try {
    const sql = await conectar()
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ erro: 'Mercado inválido.' })
    }

    const [mercado] = await sql`
      SELECT m.*,
        (SELECT COUNT(*)::int FROM produtos p
           JOIN categorias c ON c.id_categoria = p.id_categoria
          WHERE c.id_mercado = m.id_mercado) AS total_produtos,
        (SELECT COUNT(*)::int FROM historico_compras h WHERE h.id_mercado = m.id_mercado) AS total_pedidos,
        (SELECT COALESCE(SUM(h.valor_total), 0)::numeric FROM historico_compras h
          WHERE h.id_mercado = m.id_mercado) AS faturamento
      FROM mercados m
      WHERE m.id_mercado = ${id}
    `
    if (!mercado) return res.status(404).json({ erro: 'Mercado não encontrado' })

    const categorias = await sql`
      SELECT c.id_categoria, c.nome,
        (SELECT COUNT(*)::int FROM produtos p WHERE p.id_categoria = c.id_categoria) AS total_produtos
      FROM categorias c
      WHERE c.id_mercado = ${id}
      ORDER BY c.nome ASC
    `

    const cupons = await sql`
      SELECT id, codigo, tipo, valor, min_pedido, max_usos, usos, validade, ativo, criado_em
      FROM cupons WHERE id_mercado = ${id}
      ORDER BY ativo DESC, criado_em DESC
      LIMIT 100
    `

    const escopos = cupons.length > 0
      ? await sql`
          SELECT cc.id_cupom, c.id_categoria, c.nome
          FROM cupom_categorias cc
          JOIN categorias c ON c.id_categoria = cc.id_categoria
          WHERE cc.id_cupom = ANY(${cupons.map(c => c.id)})
          ORDER BY c.nome ASC
        `
      : []

    const donos = await sql`
      SELECT u.id_usuario, u.nome, u.email, um.papel
      FROM usuarios_mercados um
      JOIN usuarios u ON u.id_usuario = um.id_usuario
      WHERE um.id_mercado = ${id}
      ORDER BY CASE um.papel WHEN 'dono' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END
    `

    const porCupom = new Map()
    for (const linha of escopos) {
      const chave = Number(linha.id_cupom)
      if (!porCupom.has(chave)) porCupom.set(chave, [])
      porCupom.get(chave).push({ id: Number(linha.id_categoria), nome: linha.nome })
    }

    res.json({
      mercado,
      categorias,
      cupons: cupons.map(c => ({ ...c, categorias: porCupom.get(Number(c.id)) ?? [] })),
      equipe: donos,
    })
  } catch (err) {
    console.error('Erro ao ver mercado (admin):', err.message)
    res.status(500).json({ erro: 'Erro ao carregar o mercado' })
  }
}

// ─── Bloquear/Desbloquear Mercado ───────────────────────────────────────────

async function bloquearMercado(req, res) {
  try {
    const sql = await conectar()
    const { id } = req.params

    const [mercado] = await sql`SELECT id_mercado, status FROM mercados WHERE id_mercado = ${Number(id)}`
    if (!mercado) return res.status(404).json({ erro: 'Mercado não encontrado' })

    const novoStatus = mercado.status === 'bloqueado' ? 'ativo' : 'bloqueado'
    await sql`UPDATE mercados SET status = ${novoStatus} WHERE id_mercado = ${Number(id)}`

    res.json({ mensagem: `Mercado ${novoStatus === 'bloqueado' ? 'bloqueado' : 'desbloqueado'} com sucesso`, status: novoStatus })
  } catch (err) {
    console.error('Erro ao bloquear mercado:', err.message)
    res.status(500).json({ erro: 'Erro ao bloquear mercado' })
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatarMeses(dados) {
  const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
  return dados.map(d => {
    const [ano, mes] = d.mes.split('-')
    return {
      mes: `${meses[Number(mes) - 1]}/${ano.slice(2)}`,
      total: d.total,
    }
  })
}

module.exports = {
  dashboard,
  listarUsuarios,
  detalhesUsuario,
  editarUsuario,
  bloquearUsuario,
  statusUsuario,
  excluirUsuario,
  relatorios,
  atividadeRecente,
  alertas,
  listarMercadosAdmin,
  detalheMercadoAdmin,
  bloquearMercado,
}
