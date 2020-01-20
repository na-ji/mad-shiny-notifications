const axios = require('axios');

const {
  madminUrl,
  discordWebhook,
  madminUsername,
  madminPassword,
  telegramToken,
  telegramChatId,
  interval
} = require('./config');

const timeout = (+interval ? +interval : 60) * 1000;
const sentNotifications = {};

const run = async () => {
  try {
    const now = Math.floor(new Date().getTime() / 1000);
    const timeoutAgo = now - (+interval ? +interval : 60);
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
      `${madminUrl}/get_game_stats_shiny?from=${timeoutAgo}&to=${now}`,
      options
    )).data;
    console.log({ now, timeoutAgo, response });

    if (response.empty) {
      return;
    }

    const { shiny_statistics: shinyStats } = response;

    // message generation
    const output = shinyStats.reduce((output, shiny) => {
      const cacheKey = `e${shiny.encounter_id}-m${shiny.mon_id}-f${shiny.form}`;

      if (!(cacheKey in sentNotifications)) {
        sentNotifications[cacheKey] =
          new Date(shiny.timestamp).getTime() / 1000;

        output += `- **${shiny.name}** at **${shiny.timestamp}** by **${shiny.worker}** at **${shiny.lat_5},${shiny.lng_5}**\n`;
      }

      return output;
    }, '');

    // clean up
    Object.keys(sentNotifications).forEach(cacheKey => {
      if (now > sentNotifications[cacheKey] + 3600) {
        delete sentNotifications[cacheKey];
      }
    });

    console.log({ output });

    if (output === '') {
      return;
    }

    if (discordWebhook && discordWebhook !== '') {
      await axios.post(discordWebhook, {
        username: shinyStats[0].name,
        avatar_url: `${madminUrl}/${shinyStats[0].img}`,
        content: output
      });
    }

    if (
      telegramToken &&
      telegramToken !== '' &&
      telegramChatId &&
      telegramChatId !== ''
    ) {
      await axios.get(
        `https://api.telegram.org/bot${telegramToken}/sendMessage?chat_id=${telegramChatId}&parse_mode=markdown&text=${output.replace(
          /\*\*/g,
          '*'
        )}`
      );
    }
  } catch (err) {
    console.log('Something went wrong, check error: ', err);
  }
};

run();
setInterval(run, timeout);
