const { conectar } = require('../db/neon');
const { enviarNotificacao } = require('../utils/notificacoes');

// GET /api/notificacoes — histórico do usuário logado.
// Inclui os avisos da conta e os avisos dos mercados dos quais ele é dono.
const listar = async (req, res) => {
  try {
    const sql = await conectar();

    const [usuario] = await sql`
      SELECT nome, email FROM usuarios WHERE id_usuario = ${req.usuarioId}
    `;

    const notificacoes = await sql`
      SELECT n.*
      FROM notificacoes n
      WHERE n.id_usuario = ${req.usuarioId}
         OR n.id_mercado IN (
           SELECT id_mercado FROM usuarios_mercados WHERE id_usuario = ${req.usuarioId}
           )
      ORDER BY n.lida ASC, n.id DESC
      LIMIT 50
    `;

    const naoLidas = notificacoes.filter((item) => !item.lida).length;

    res.json({
      notificacoes,
      naoLidas,
      email: usuario?.email || '',
      canal: 'email',
      canalConfigurado: Boolean(process.env.RESEND_API_KEY),
    });
  } catch (err) {
    console.error('ERRO listar notificações:', err);
    res.status(500).json({ erro: 'Não foi possível carregar as notificações.' });
  }
};

// POST /api/notificacoes/:id/lida — marca um aviso como lido.
// Só afeta notificações da própria conta (ou dos mercados que ela gerencia).
const marcarComoLida = async (req, res) => {
  try {
    const sql = await conectar();
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ erro: 'Identificador de notificação inválido.' });
    }

    const [atualizada] = await sql`
      UPDATE notificacoes n
      SET lida = TRUE
      WHERE n.id = ${id}
        AND (
          n.id_usuario = ${req.usuarioId}
          OR n.id_mercado IN (
            SELECT id_mercado FROM usuarios_mercados WHERE id_usuario = ${req.usuarioId}
          )
        )
      RETURNING n.id
    `;

    if (!atualizada) {
      return res.status(404).json({ erro: 'Notificação não encontrada.' });
    }

    res.json({ ok: true, id: atualizada.id });
  } catch (err) {
    console.error('ERRO marcar notificação como lida:', err);
    res.status(500).json({ erro: 'Não foi possível marcar a notificação como lida.' });
  }
};

// POST /api/notificacoes/lidas — marca todas do usuário como lidas.
const marcarTodasComoLidas = async (req, res) => {
  try {
    const sql = await conectar();

    await sql`
      UPDATE notificacoes n
      SET lida = TRUE
      WHERE n.lida = FALSE
        AND (
          n.id_usuario = ${req.usuarioId}
          OR n.id_mercado IN (
            SELECT id_mercado FROM usuarios_mercados WHERE id_usuario = ${req.usuarioId}
          )
        )
    `;

    res.json({ ok: true });
  } catch (err) {
    console.error('ERRO marcar notificações como lidas:', err);
    res.status(500).json({ erro: 'Não foi possível marcar as notificações como lidas.' });
  }
};

// POST /api/notificacoes/teste — manda um aviso de teste para o e-mail
// cadastrado. Serve para a pessoa conferir que as notificações chegam na
// caixa de entrada.
const enviarTeste = async (req, res) => {
  try {
    const sql = await conectar();

    const [usuario] = await sql`
      SELECT nome, email FROM usuarios WHERE id_usuario = ${req.usuarioId}
    `;

    if (!usuario?.email) {
      return res.status(400).json({
        erro: 'Cadastre um e-mail no seu perfil antes de enviar o teste.',
      });
    }

    const primeiroNome = String(usuario.nome || '').split(' ')[0] || 'tudo bem';
    const mensagem = `Olá, ${primeiroNome}! Este é um aviso de teste do Mercadins. Quando você fizer um cadastro, um pedido ou receber uma atualização de entrega, o aviso chega neste e-mail.`;

    const registro = await enviarNotificacao(sql, {
      id_usuario: req.usuarioId,
      email: usuario.email,
      tipo: 'teste',
      titulo: 'Notificação de teste',
      mensagem,
    });

    if (!registro) {
      return res.status(500).json({
        erro: 'Não foi possível registrar a notificação de teste.',
      });
    }

    res.status(201).json({
      mensagem:
        registro.status === 'enviada'
          ? 'Notificação de teste enviada para o seu e-mail.'
          : 'Teste registrado no histórico. O envio automático de e-mail não está configurado no servidor.',
      notificacao: registro,
      canal: 'email',
      canalConfigurado: Boolean(process.env.RESEND_API_KEY),
    });
  } catch (err) {
    console.error('ERRO enviar teste de notificação:', err);
    res.status(500).json({ erro: 'Não foi possível enviar o teste agora.' });
  }
};

module.exports = { listar, enviarTeste, marcarComoLida, marcarTodasComoLidas };
