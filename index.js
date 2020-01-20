const axios = require('axios');
const { createLogger, format, transports } = require('winston');

const {
  madminUrl,
  discordWebhook,
  madminUsername,
  madminPassword,
  telegramToken,
  telegramChatId,
  disableLogPersist,
  interval
} = require('./config');

const timeout = (+interval ? +interval : 60) * 1000;
let timeoutAgo;
const sentNotifications = {};

const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    format.errors({ stack: true }),
    format.splat(),
    format.json()
  ),
  transports: [
    new transports.Console({
      format: format.combine(format.colorize(), format.simple())
    })
  ]
});

if (!disableLogPersist) {
  logger.add(new transports.File({ filename: 'error.log', level: 'error' }));
  logger.add(new transports.File({ filename: 'combined.log' }));
}

const run = async () => {
  try {
    const now = Math.floor(new Date().getTime() / 1000);
    if (typeof timeoutAgo === 'undefined') {
      timeoutAgo = now - (+interval ? +interval : 60);
    }
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
    logger.info('Response received:', { now, timeoutAgo, response });

    timeoutAgo = now;

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

    logger.info('Message to send', { output });

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
  } catch (error) {
    logger.error('Something went wrong, check error: ', error);
  }
};

run();
setInterval(run, timeout);
