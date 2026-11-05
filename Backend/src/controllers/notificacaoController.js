const { conectar } = require('../db/neon');
const {
  enviarNotificacaoTelefone,
  provedorConfigurado,
  nomeDoCanal,
  linkWhatsApp,
} = require('../utils/notificacoes');

// GET /api/notificacoes — histórico do usuário logado.
// Inclui os avisos da conta e os avisos dos mercados dos quais ele é dono.
const listar = async (req, res) => {
  try {
    const sql = await conectar();

    const [usuario] = await sql`
      SELECT nome, telefone FROM usuarios WHERE id_usuario = ${req.usuarioId}
    `;

    const notificacoes = await sql`
      SELECT n.*
      FROM notificacoes n
      WHERE n.id_usuario = ${req.usuarioId}
         OR n.id_mercado IN (
           SELECT id_mercado FROM usuarios_mercados WHERE id_usuario = ${req.usuarioId}
         )
      ORDER BY n.id DESC
      LIMIT 50
    `;

    res.json({
      notificacoes: notificacoes.map((item) => ({
        ...item,
        linkWhatsApp: linkWhatsApp(item.telefone, item.mensagem),
      })),
      telefone: usuario?.telefone || '',
      canal: nomeDoCanal(),
      canalConfigurado: provedorConfigurado(),
    });
  } catch (err) {
    console.error('ERRO listar notificações:', err);
    res.status(500).json({ erro: 'Não foi possível carregar as notificações.' });
  }
};

// POST /api/notificacoes/teste — manda um aviso de teste para o telefone
// cadastrado. Serve para a pessoa conferir o número e, no futuro, validar o
// provedor de WhatsApp/SMS sem precisar fazer um pedido de verdade.
const enviarTeste = async (req, res) => {
  try {
    const sql = await conectar();

    const [usuario] = await sql`
      SELECT nome, telefone FROM usuarios WHERE id_usuario = ${req.usuarioId}
    `;

    if (!usuario?.telefone) {
      return res.status(400).json({
        erro: 'Cadastre um telefone no seu perfil antes de enviar o teste.',
      });
    }

    const primeiroNome = String(usuario.nome || '').split(' ')[0] || 'tudo bem';
    const mensagem = `Olá, ${primeiroNome}! Este é um aviso de teste do Mercadins. Quando você fizer um cadastro, um pedido ou receber uma atualização de entrega, o aviso chega neste telefone.`;

    const registro = await enviarNotificacaoTelefone(sql, {
      id_usuario: req.usuarioId,
      telefone: usuario.telefone,
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
      mensagem: provedorConfigurado()
        ? 'Notificação de teste enviada para o seu telefone.'
        : 'Teste registrado. O envio automático ainda não está configurado no servidor.',
      notificacao: registro,
      canal: nomeDoCanal(),
      canalConfigurado: provedorConfigurado(),
    });
  } catch (err) {
    console.error('ERRO enviar teste de notificação:', err);
    res.status(500).json({ erro: 'Não foi possível enviar o teste agora.' });
  }
};

module.exports = { listar, enviarTeste };
