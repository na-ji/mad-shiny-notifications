const axios = require('axios');

const {
  madminUrl,
  discordWebhook,
  madminUsername,
  madminPassword,
  telegramToken,
  telegramChatId
} = require('./config');

const now = Math.floor(new Date().getTime() / 1000);
const oneMinuteAgo = now - 64;

(async () => {
  const options = {};
  if (
    madminUsername &&
    madminUsername !== '' &&
    madminPassword &&
    madminPassword !== ''
  ) {
    options.auth = {
      username: madminUsername,
      password: madminPassword
    };
  }

  const response = (await axios.get(
    `${madminUrl}/get_game_stats_shiny?from=${oneMinuteAgo}&to=${now}`,
    options
  )).data;
  console.log({ now, oneMinuteAgo, response });
  if (response.empty) {
    return;
  }

  const { shiny_statistics: shinyStats } = response;
  const output = shinyStats.reduce((output, shiny) => {
    output += `- **${shiny.name}** at **${shiny.timestamp}** by **${shiny.worker}** at **${shiny.lat_5},${shiny.lng_5}**\n`;

    return output;
  }, '');

  if (discordWebhook && discordWebhook !== '') {
    await axios.post(discordWebhook, {
      username: shinyStats[0].name,
      avatar_url: `${madminUrl}/${shinyStats[0].img}`,
      content: output
    });
  }

  if (telegramToken && telegramToken !== '' && telegramChatId && telegramChatId !== '') {
    await axios.get(`https://api.telegram.org/bot${telegramToken}/sendMessage?chat_id=${telegramChatId}&parse_mode=markdown&text=${output.replace(/\*\*/g, '*')}`);
  }
})();
