export interface GameItem {
  id: string;
  name: string;
  description: string;
  cover: string;
}

export const mockGames: GameItem[] = [
  {
    id: "mobfall",
    name: "MobFall",
    description: "Vampire survival game",
    cover: "https://placehold.co/600x300?text=MobFall",
  },
  {
    id: "escapelab",
    name: "Escape Lab",
    description: "Try to escape from a labyrinth",
    cover: "https://placehold.co/600x300?text=Arena+X",
  },
];