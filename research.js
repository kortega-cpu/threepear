const Anthropic = require('@anthropic-ai/sdk');

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

const RESEARCH_PROMPT = (date) => `You are researching a daily MLB betting pick: exactly 3 player legs for an "Over 1.5 Hits+Runs+RBIs" same-market parlay for ${date}.

Use web search to find:
- Today's confirmed MLB schedule, probable pitchers, and starting lineups
- Recent hitter form (last 5-10 games), matchup history vs today's opposing pitcher, ballpark factors, weather, and any relevant injury/lineup news
- Prefer hitters with a clearly weak/vulnerable pitching matchup or a standout recent hot streak

Rules:
- Pick exactly 3 hitters from 3 DIFFERENT games (no two legs from the same matchup)
- Every leg must be for the "Over 1.5 Hits+Runs+RBIs" market specifically, not a different prop
- Do not pick a player who is injured, out of the lineup, or on a team on a bye/off day
- If you find actual sportsbook odds for the specific H+R+RBI line, include them; otherwise leave odds blank rather than guessing

When you are done researching, respond with ONLY the following as your final output, with nothing before or after it:
===PICKS_JSON===
{"legs":[{"player":"","team":"","opponent":"","odds":"","reasoning":""},{"player":"","team":"","opponent":"","odds":"","reasoning":""},{"player":"","team":"","opponent":"","odds":"","reasoning":""}]}

The "reasoning" field should be one concise sentence (matchup, streak, or weather driven). The "odds" field should be a string like "-135" or "" if unknown.`;

async function generatePicks(date) {
  if (!anthropic) {
    throw new Error(
      'ANTHROPIC_API_KEY is not set. Copy .env.example to .env and add your key.'
    );
  }

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 4000,
    tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 8 }],
    messages: [{ role: 'user', content: RESEARCH_PROMPT(date) }],
  });

  const text = response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n');

  const match = text.match(/===PICKS_JSON===\s*([\s\S]*)/);
  if (!match) {
    throw new Error('Model did not return picks in the expected format. Try again.');
  }

  let parsed;
  try {
    parsed = JSON.parse(match[1].trim());
  } catch {
    throw new Error('Model returned malformed JSON. Try again.');
  }

  if (!parsed.legs || !Array.isArray(parsed.legs) || parsed.legs.length !== 3) {
    throw new Error('Model did not return exactly 3 legs. Try again.');
  }

  return parsed.legs.map((leg) => ({
    player: leg.player || '',
    team: leg.team || '',
    opponent: leg.opponent || '',
    odds: leg.odds || '',
    reasoning: leg.reasoning || '',
    line: 'Over 1.5 H+R+RBI',
  }));
}

module.exports = { generatePicks };
