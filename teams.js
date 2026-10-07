const brazil = [
  ['Athletico Paranaense', 'athletico-paranaense'], ['Atlético Mineiro', 'atletico-mineiro'],
  ['Bahia', 'bahia'], ['Botafogo', 'botafogo'], ['Chapecoense', 'chapecoense'],
  ['Corinthians', 'corinthians'], ['Coritiba', 'coritiba'], ['Cruzeiro', 'cruzeiro'],
  ['Flamengo', 'flamengo'], ['Fluminense', 'fluminense'], ['Grêmio', 'gremio'],
  ['Internacional', 'internacional'], ['Mirassol', 'mirassol'], ['Palmeiras', 'palmeiras'],
  ['Red Bull Bragantino', 'red-bull-bragantino'], ['Remo', 'remo'], ['Santos', 'santos'],
  ['São Paulo', 'sao-paulo'], ['Vasco da Gama', 'vasco-da-gama'], ['Vitória', 'vitoria']
];
const europe = [
  ['Real Madrid', 'real-madrid', 'Espanha', 'La Liga'],
  ['Barcelona', 'barcelona', 'Espanha', 'La Liga'],
  ['Atlético de Madrid', 'atletico-de-madrid', 'Espanha', 'La Liga'],
  ['Manchester City', 'manchester-city', 'Inglaterra', 'Premier League'],
  ['Manchester United', 'manchester-united', 'Inglaterra', 'Premier League'],
  ['Liverpool', 'liverpool', 'Inglaterra', 'Premier League'],
  ['Arsenal', 'arsenal', 'Inglaterra', 'Premier League'],
  ['Chelsea', 'chelsea', 'Inglaterra', 'Premier League'],
  ['Tottenham', 'tottenham', 'Inglaterra', 'Premier League'],
  ['Bayern de Munique', 'bayern-de-munique', 'Alemanha', 'Bundesliga'],
  ['Borussia Dortmund', 'borussia-dortmund', 'Alemanha', 'Bundesliga'],
  ['PSG', 'psg', 'França', 'Ligue 1'],
  ['Olympique de Marseille', 'olympique-de-marseille', 'França', 'Ligue 1'],
  ['Juventus', 'juventus', 'Itália', 'Serie A'],
  ['Milan', 'milan', 'Itália', 'Serie A'],
  ['Inter de Milão', 'inter-de-milao', 'Itália', 'Serie A'],
  ['Napoli', 'napoli', 'Itália', 'Serie A'],
  ['Roma', 'roma', 'Itália', 'Serie A'],
  ['Benfica', 'benfica', 'Portugal', 'Primeira Liga'],
  ['Porto', 'porto', 'Portugal', 'Primeira Liga'],
  ['Sporting', 'sporting', 'Portugal', 'Primeira Liga'],
  ['Ajax', 'ajax', 'Países Baixos', 'Eredivisie'],
  ['Al-Nassr', 'al-nassr', 'Arábia Saudita', 'Saudi Pro League']
];
const nationalTeams = [
  ['Brasil', 'selecao-brasil'], ['Argentina', 'selecao-argentina'],
  ['França', 'selecao-franca'], ['Alemanha', 'selecao-alemanha'],
  ['Espanha', 'selecao-espanha'], ['Inglaterra', 'selecao-inglaterra'],
  ['Portugal', 'selecao-portugal'], ['Itália', 'selecao-italia'],
  ['Países Baixos', 'selecao-paises-baixos'], ['Uruguai', 'selecao-uruguai'],
  ['Croácia', 'selecao-croacia'], ['Bélgica', 'selecao-belgica'],
  ['Estados Unidos', 'selecao-estados-unidos'], ['México', 'selecao-mexico'],
  ['Japão', 'selecao-japao'], ['Marrocos', 'selecao-marrocos']
];

const homePriority = [
  'real-madrid', 'barcelona', 'flamengo', 'palmeiras', 'corinthians',
  'sao-paulo', 'manchester-united', 'liverpool', 'chelsea', 'bayern-de-munique'
];

export const teamPresets = [
  ...brazil.map(([name, id]) => ({ id, name, slug: id, country: 'Brasil', league: 'Brasileirão Série A', category: 'Brasil' })),
  ...europe.map(([name, id, country, league]) => ({ id, name, slug: id, country, league, category: 'Europa' })),
  ...nationalTeams.map(([name, id]) => ({ id, name, slug: id, country: name, league: '', category: 'Seleções' })),
  { id: 'selecoes', name: 'Seleções', slug: 'selecoes', country: '', league: '', category: 'Seleções' },
  { id: 'retro', name: 'Retrô', slug: 'retro', country: '', league: '', category: 'Retrô' }
].map((team, index) => ({
  ...team,
  logo_url: team.id === 'selecoes' ? '/assets/team-logos/selecoes.svg'
    : ['Brasil','Europa','Seleções'].includes(team.category) ? `/assets/team-logos/${team.id}.png` : '',
  is_active: true, show_on_home: homePriority.includes(team.id),
  sort_order: homePriority.includes(team.id) ? homePriority.indexOf(team.id) + 1 : 100 + index
}));

export function prepareTeamsCatalog(catalog) {
  const existing = Array.isArray(catalog.categories) ? catalog.categories : [];
  const byId = new Map(existing.map(team => [team.id, team]));
  const teams = teamPresets.map(preset => {
    const saved = byId.get(preset.id);
    const team = { ...preset, ...(saved || {}) };
    if (preset.logo_url && saved && !saved.logo_url && saved.logo_disabled !== true) {
      team.logo_url = preset.logo_url;
    }
    return team;
  });
  for (const team of existing) {
    if (teamPresets.some(preset => preset.id === team.id)) continue;
    teams.push({
      id: team.id, name: team.name, slug: team.slug || team.id,
      logo_url: team.logo_url || '', country: team.country || '', league: team.league || '',
      category: team.category || 'Brasil', is_active: team.is_active ?? false,
      show_on_home: team.show_on_home ?? false, sort_order: team.sort_order ?? 1000,
      ...team
    });
  }
  const teamIds = new Set(teams.map(team => team.id));
  const products = (catalog.products || []).map(product => ({
    ...product,
    team_id: product.team_id ?? (teamIds.has(product.team) ? product.team : '')
  }));
  return { ...catalog, categories: teams, products };
}
