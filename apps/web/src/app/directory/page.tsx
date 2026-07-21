import { getListedApis } from "@/lib/db/apis";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Globe, TerminalSquare, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function DirectoryPage() {
  const apis = await getListedApis();

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-[#f0f0ff] p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-gradient-to-tr from-violet-600 to-teal-400 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-lg font-bold text-white">PG</span>
              </div>
              <h1 className="text-3xl font-bold tracking-tight">PayGate Directory</h1>
            </div>
            <p className="text-zinc-400 text-lg">
              Discover pay-per-call APIs powered by x402 and Stellar.
            </p>
          </div>
          <div className="flex gap-3">
            <Button asChild variant="outline" className="border-zinc-700 bg-transparent hover:bg-zinc-800">
              <Link href="/login">Developer Login</Link>
            </Button>
            <Button asChild className="bg-violet-600 hover:bg-violet-700 text-white">
              <Link href="/login">Submit API</Link>
            </Button>
          </div>
        </div>

        {/* Directory Grid */}
        {apis.length === 0 ? (
          <div className="text-center p-16 border border-zinc-800 border-dashed rounded-2xl bg-zinc-900/30">
            <Globe className="h-12 w-12 text-zinc-600 mx-auto mb-4" />
            <h3 className="text-xl font-medium text-zinc-300">No public APIs yet</h3>
            <p className="text-zinc-500 mt-2">
              Be the first to list your API in the PayGate directory.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {apis.map((api) => (
              <Card key={api.slug} className="bg-zinc-900/50 border-zinc-800 hover:border-violet-500/50 hover:bg-zinc-900 transition-all group flex flex-col">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-xl group-hover:text-violet-400 transition-colors">
                      {api.name}
                    </CardTitle>
                    <Badge variant="outline" className="bg-teal-500/10 text-teal-400 border-teal-500/20 whitespace-nowrap ml-2">
                      {api.priceUsdc.toString()} USDC
                    </Badge>
                  </div>
                  <CardDescription className="text-zinc-400 line-clamp-2 mt-2">
                    {api.description || "No description provided."}
                  </CardDescription>
                </CardHeader>
                
                <CardContent className="flex-1">
                  <div className="bg-zinc-950 border border-zinc-800 p-3 rounded-lg overflow-x-auto">
                    <p className="text-xs text-zinc-500 mb-1 font-mono uppercase tracking-wider">Endpoint</p>
                    <code className="text-sm font-mono text-violet-300 whitespace-nowrap">
                      https://paygate.xyz/api/x/{api.slug}
                    </code>
                  </div>
                </CardContent>
                
                <CardFooter className="pt-0">
                  <Button variant="ghost" className="w-full justify-between text-zinc-400 hover:text-white hover:bg-zinc-800">
                    <span className="flex items-center">
                      <TerminalSquare className="w-4 h-4 mr-2" />
                      View Documentation
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

