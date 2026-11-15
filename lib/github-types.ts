export type Developer = { login: string; name: string | null; url: string };
export type Follow = { source: string; target: string };
export type GitHubSnapshot = {
  profiles: [Developer, Developer]; developers: Developer[]; follows: Follow[];
  fetchedAt: string; truncated: boolean; remaining: number | null;
};
