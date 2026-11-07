import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
  const { searchParams } = new URL(context.request.url);
  const repo = searchParams.get('repo') || '';
  const author = searchParams.get('author') || '';

  if (!repo || !author) {
    return new Response(
      JSON.stringify({ error: 'Missing repo or author parameter' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Fetch README from GitHub API
    const apiUrl = `https://api.github.com/repos/${author}/${repo}/contents/README.md`;
    
    // Use GITHUB_TOKEN if available, otherwise make unauthenticated request
    const githubToken = import.meta.env.GITHUB_TOKEN;
    
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
    };

    if (githubToken) {
      headers.Authorization = `token ${githubToken}`;
    }

    const response = await fetch(apiUrl, {
      headers,
    });

    if (!response.ok) {
      // If no README found, return empty content
      if (response.status === 404) {
        return new Response(
          JSON.stringify({ content: '', encoding: 'base64' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      // Return error but don't crash
      return new Response(
        JSON.stringify({ content: '', error: `GitHub API returned ${response.status}` }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();

    // Decode base64 content
    const content = Buffer.from(data.content, 'base64').toString('utf-8');

    return new Response(
      JSON.stringify({ content, encoding: data.encoding || 'base64' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error fetching README:', error);
    return new Response(
      JSON.stringify({ content: '', error: 'Failed to fetch README' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }
}