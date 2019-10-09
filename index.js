const axios = require('axios');

const { madminUrl, discordWebhook } = require('./config');

const now = Math.floor(new Date().getTime() / 1000);
const oneMinuteAgo = now - 64;

(async () => {
  const response = (await axios.get(
    `${madminUrl}/get_game_stats_shiny?from=${oneMinuteAgo}&to=${now}`
  )).data;
  console.log({ now, oneMinuteAgo, response });
  if (response.empty) {
    return;
  }

  const { shiny_statistics: shinyStats } = response;
  const output = shinyStats.reduce((output, shiny) => {
    output += `\n - **${shiny.name}** at **${shiny.timestamp}** by **${shiny.worker}** at **${shiny.lat_5},${shiny.lng_5}**`;

    return output;
  }, 'Encountered shinies:');

  await axios.post(discordWebhook, {
    username: shinyStats[0].name,
    avatar_url: `${madminUrl}/${shinyStats[0].img}`,
    content: output
  });
})();
