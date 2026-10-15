# Agenda Fácil — Escopo e funcionalidades futuras

Decisão do projeto: entregar primeiro **o essencial para o aplicativo funcionar**. O que apenas agrega valor fica como evolução planejada, sem prejuízo da arquitetura atual.

## Escopo essencial (versão 1)

**Cliente**
- Cadastro e login (e-mail/senha e Google)
- Serviços perto de mim: lista de locais por proximidade, serviços do local, dia e horário
- Confirmação do agendamento
- Meus agendamentos: calendário, status, detalhes e cancelamento

**Profissional**
- Cadastro e login, com endereço do local (CEP, endereço, número, bairro, cidade, UF)
- Agenda do dia (linha do tempo): confirmar, concluir e cancelar
- Meus serviços: criar, editar e desativar
- Disponibilidade: dias, horários e bloqueios
- Agenda da semana, com filtro por status

**Geral**
- Página inicial, recuperação de senha, termos de uso

## Funcionalidades futuras

| Funcionalidade | Perfil | Observação para a evolução |
|---|---|---|
| Confirmação de e-mail no cadastro (e-mail/senha) | Ambos | Hoje alguém pode criar conta com o e-mail de outra pessoa sem provar que é dono dele e, com isso, bloquear o cadastro do verdadeiro dono. Plano: enviar o link de verificação do Firebase, a API exigir `email_verified` antes de criar a conta e o front guardar o formulário para concluir o cadastro sozinho depois do clique. Contas Google já chegam verificadas. **Já existe em parte:** quando o e-mail já tem cadastro ligado a outro login (conta apagada e recriada no Firebase), o site envia o link e a API só religa o cadastro depois da confirmação |
| Reagendar um agendamento | Cliente | O botão já existe desabilitado ("em breve"); reaproveita o seletor de dia e horário |
| Minha conta (editar dados, senha, localização padrão) | Ambos | Depende de Firebase Auth e da tabela de usuários |
| Perfil público do local (fotos, descrição) | Cliente / Profissional | Exige armazenamento de imagens |
| Avaliar o atendimento (nota e comentário) | Cliente | Alimenta a nota exibida nos locais; nova tabela de avaliações |
| Avaliações recebidas | Profissional | Mesma tabela de avaliações |
| Favoritos (locais e profissionais) | Cliente | Nova tabela de favoritos |
| Notificações e lembretes de horário | Ambos | Pode usar e-mail ou push; exige serviço de envio |
| Adicionar o agendamento ao calendário (Google/ICS) | Cliente | Arquivo .ics gerado no navegador |
| Resumo de desempenho (atendimentos, faturamento estimado, serviços mais pedidos) | Profissional | Consultas agregadas no MySQL |
| Lista de clientes atendidos | Profissional | Consulta sobre o histórico de agendamentos |
| Geolocalização real e mapa | Cliente | Latitude e longitude no MySQL; hoje a localização é de exemplo |
| Preenchimento automático do endereço pelo CEP | Profissional | Consulta a uma API pública de CEP |
| Sobre / Como funciona / Ajuda (perguntas frequentes) | Todos | Conteúdo estático |
