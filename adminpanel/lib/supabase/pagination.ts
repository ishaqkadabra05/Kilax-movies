export async function fetchAllSupabaseRows<T>(query: any, pageSize = 1000): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await query.range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;

    rows.push(...(data as T[]));
    if (data.length < pageSize) break;
    from += data.length;
  }

  return rows;
}

export async function listAllAuthUsers(client: any, pageSize = 1000): Promise<any[]> {
  const users: any[] = [];
  let page = 1;

  while (true) {
    const { data, error } = await client.auth.admin.listUsers({
      page,
      perPage: pageSize,
    });

    if (error) throw error;
    const batch = Array.isArray(data?.users) ? data.users : [];
    users.push(...batch);

    if (batch.length < pageSize) break;
    page += 1;
  }

  return users;
}
