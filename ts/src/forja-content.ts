import type { ForjaPackage, MemorialRank } from "./types";

export async function loadForjaJson<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Falha ao carregar ${path}`);
  return response.json() as Promise<T>;
}

export async function loadPackages(): Promise<ForjaPackage[]> {
  return loadForjaJson<ForjaPackage[]>("data/json/packages.json");
}

export async function loadMemorialRanks(): Promise<MemorialRank[]> {
  return loadForjaJson<MemorialRank[]>("data/json/memorial-ranks.json");
}
