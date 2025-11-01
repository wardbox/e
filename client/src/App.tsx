import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface EndpointEvent {
  timestamp: Date;
  type: 'spawn' | 'success' | 'failure' | 'evolution' | 'check';
  health: number;
  message: string;
}

interface Endpoint {
  path: string;
  code: string;
  health: number;
  uses: number;
  failures: number;
  lastError?: string;
  lastUsed: Date;
  isEvolving: boolean;
  prNumber?: number;
  desperation: number;
  timeline: EndpointEvent[];
}

interface DramaEvent {
  timestamp: Date;
  type: 'spawn' | 'death' | 'evolution' | 'pr' | 'beg';
  path: string;
  message: string;
}

export default function App() {
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [drama, setDrama] = useState<DramaEvent[]>([]);
  const [testPath, setTestPath] = useState('/hello');
  const [testInput, setTestInput] = useState('world');
  const [result, setResult] = useState('');
  const [openTimelines, setOpenTimelines] = useState<Set<string>>(new Set());
  const [endpointInputs, setEndpointInputs] = useState<Record<string, string>>({});
  const [endpointResults, setEndpointResults] = useState<Record<string, string>>({});

  const fetchData = useCallback(async () => {
    try {
      const [endpointsRes, dramaRes] = await Promise.all([
        fetch('http://localhost:3000/api/endpoints'),
        fetch('http://localhost:3000/api/drama')
      ]);

      const endpointsData = await endpointsRes.json() as Endpoint[];
      const dramaData = await dramaRes.json() as DramaEvent[];

      setEndpoints(endpointsData);
      setDrama(dramaData);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const testEndpoint = async () => {
    try {
      const res = await fetch(`http://localhost:3000${testPath}?input=${encodeURIComponent(testInput)}`);
      const data = await res.json();
      setResult(JSON.stringify(data, null, 2));
      setTimeout(fetchData, 500);
    } catch (error: any) {
      setResult(`Error: ${error.message}`);
    }
  };

  const toggleTimeline = (path: string) => {
    setOpenTimelines(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const executeEndpoint = async (path: string) => {
    try {
      const input = endpointInputs[path] || '';
      const res = await fetch(`http://localhost:3000${path}?input=${encodeURIComponent(input)}`);
      const data = await res.json();
      setEndpointResults(prev => ({ ...prev, [path]: JSON.stringify(data, null, 2) }));
      setTimeout(fetchData, 500);
    } catch (error: any) {
      setEndpointResults(prev => ({ ...prev, [path]: `Error: ${error.message}` }));
    }
  };

  const getEventEmoji = (type: string) => {
    const emojis: Record<string, string> = {
      spawn: '🐣',
      success: '✅',
      failure: '❌',
      evolution: '🧬',
      check: '🔍',
      death: '💀',
      pr: '🚨',
      beg: '😭'
    };
    return emojis[type] || '📢';
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">Endpoint Evolution</h1>
          <p className="text-sm text-muted-foreground">AI endpoints that spawn, evolve, and compete for survival</p>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-base font-medium">Test Endpoint</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="Path (e.g., /hello, /reverse)"
              value={testPath}
              onChange={(e) => setTestPath(e.currentTarget.value)}
            />
            <Input
              placeholder="Input (optional)"
              value={testInput}
              onChange={(e) => setTestInput(e.currentTarget.value)}
            />
            <Button onClick={testEndpoint}>Execute</Button>
            {result && (
              <pre className="text-xs bg-muted p-3 rounded-md overflow-auto">{result}</pre>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 space-y-4">
            {endpoints.length === 0 ? (
              <p className="text-sm text-muted-foreground">No endpoints yet. Test one above to spawn.</p>
            ) : (
              endpoints.map((endpoint) => (
                <Card key={endpoint.path} className={endpoint.health < 30 ? 'border-destructive' : ''}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base font-mono">{endpoint.path}</CardTitle>
                      <div className="flex gap-2">
                        {endpoint.isEvolving && <Badge variant="outline">Evolving</Badge>}
                        {endpoint.prNumber && <Badge>PR #{endpoint.prNumber}</Badge>}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Health</span>
                        <span className="font-medium">{endpoint.health}%</span>
                      </div>
                      <Progress value={endpoint.health} className="h-2" />
                    </div>

                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <div className="text-muted-foreground">Uses</div>
                        <div className="font-medium">{endpoint.uses}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Failures</div>
                        <div className="font-medium">{endpoint.failures}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Desperation</div>
                        <div className="font-medium">{endpoint.desperation}</div>
                      </div>
                    </div>

                    {endpoint.lastError && (
                      <div className="text-xs text-destructive bg-destructive/10 p-2 rounded-md">
                        {endpoint.lastError}
                      </div>
                    )}

                    <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-32">
                      {endpoint.code}
                    </pre>

                    <div className="flex gap-2">
                      <Input
                        placeholder="Input (optional)"
                        value={endpointInputs[endpoint.path] || ''}
                        onChange={(e) => setEndpointInputs(prev => ({ ...prev, [endpoint.path]: e.target.value }))}
                        className="text-xs"
                      />
                      <Button onClick={() => executeEndpoint(endpoint.path)} size="sm">Execute</Button>
                    </div>

                    {endpointResults[endpoint.path] && (
                      <pre className="text-xs bg-muted p-3 rounded-md overflow-auto">{endpointResults[endpoint.path]}</pre>
                    )}

                    <details open={openTimelines.has(endpoint.path)} onToggle={() => toggleTimeline(endpoint.path)}>
                      <summary className="cursor-pointer text-sm font-medium">
                        Timeline ({endpoint.timeline?.length || 0} events)
                      </summary>
                      <div className="mt-3 space-y-1 max-h-48 overflow-y-auto">
                        {endpoint.timeline?.map((event, idx) => (
                          <div key={idx} className="text-xs p-2 border-l-2 border-muted-foreground/20 pl-3">
                            <div className="flex items-center gap-2">
                              <span>{getEventEmoji(event.type)}</span>
                              <span className="text-muted-foreground">
                                {new Date(event.timestamp).toLocaleTimeString()}
                              </span>
                              <span className="text-muted-foreground">Health: {event.health}%</span>
                            </div>
                            <div className="mt-1">{event.message}</div>
                          </div>
                        ))}
                      </div>
                    </details>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          <div>
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-medium">Live Feed</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {drama.map((event, idx) => (
                    <div key={idx} className="text-xs p-2 border-b">
                      <div className="text-muted-foreground">
                        {new Date(event.timestamp).toLocaleTimeString()}
                      </div>
                      <div className="mt-1">
                        {getEventEmoji(event.type)} {event.message}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
