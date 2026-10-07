export const HOME_TEAM_LIMIT = 10;

export function homeTeams(categories) {
  return categories
    .filter(team => team.is_active && team.show_on_home)
    .sort((a, b) => Number(a.sort_order) - Number(b.sort_order) || a.name.localeCompare(b.name, 'pt-BR'))
    .slice(0, HOME_TEAM_LIMIT);
}
