"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Globe, Copy, Check, RefreshCw, Code } from "lucide-react"
import { toast } from "sonner"
import { generateApiKey, getApiKeys } from "./actions"

export function WebsiteFormEmbed() {
    const [apiKey, setApiKey] = useState<string | null>(null)
    const [keyPrefix, setKeyPrefix] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [generating, setGenerating] = useState(false)
    const [copied, setCopied] = useState(false)

    useEffect(() => {
        checkExistingKey()
    }, [])

    async function checkExistingKey() {
        setLoading(true)
        try {
            const keys = await getApiKeys()
            const formKey = keys.find(k => k.active && k.name === "Website Form")
            if (formKey) {
                setKeyPrefix(formKey.keyPrefix)
            }
        } catch {
            // ignore
        } finally {
            setLoading(false)
        }
    }

    async function handleSetup() {
        setGenerating(true)
        try {
            const result = await generateApiKey("Website Form")
            setApiKey(result.key)
            setKeyPrefix(result.key.substring(0, 12) + "...")
        } catch (err: any) {
            toast.error(err.message || "Failed to set up")
        } finally {
            setGenerating(false)
        }
    }

    const webhookUrl = typeof window !== "undefined"
        ? `${window.location.origin}/api/webhooks/leads`
        : "/api/webhooks/leads"

    const snippetCode = apiKey
        ? generateTrackingSnippet(webhookUrl, apiKey)
        : null

    function copyToClipboard(text: string) {
        navigator.clipboard.writeText(text)
        setCopied(true)
        toast.success("Copied to clipboard!")
        setTimeout(() => setCopied(false), 2000)
    }

    if (loading) {
        return (
            <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
        )
    }

    return (
        <div className="space-y-4">
            {!apiKey && !keyPrefix ? (
                    <div className="text-center py-6 border rounded-lg border-dashed space-y-3">
                        <Globe className="h-10 w-10 mx-auto text-muted-foreground/30" />
                        <div>
                            <p className="text-sm font-medium">Capture leads from your website</p>
                            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                                Paste one script on your site. Every form submission automatically creates a contact in your CRM.
                            </p>
                        </div>
                        <Button onClick={handleSetup} disabled={generating}>
                            {generating ? "Setting up..." : "Get Tracking Script"}
                        </Button>
                    </div>
                ) : apiKey ? (
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 border-green-200 dark:border-green-800">
                                Active
                            </Badge>
                            <span className="text-xs text-muted-foreground">Ready to use</span>
                        </div>

                        <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                            <p className="text-sm font-medium">How to add to your website:</p>
                            <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
                                <li>Copy the script below</li>
                                <li>Paste it into your website — in the footer, before <code className="bg-muted px-1 py-0.5 rounded text-[11px]">&lt;/body&gt;</code>, or in your site&apos;s custom code settings</li>
                                <li>That&apos;s it — any form submission on your site will sync to your CRM</li>
                            </ol>

                            <div className="text-xs text-muted-foreground pt-2 border-t border-border/50">
                                <p className="font-medium text-foreground mb-1.5">Where to paste it:</p>
                                <ul className="space-y-1">
                                    <li><span className="font-medium text-foreground">WordPress</span> — Appearance &gt; Theme File Editor &gt; footer.php, or use a plugin like &quot;Insert Headers and Footers&quot;</li>
                                    <li><span className="font-medium text-foreground">Wix</span> — Settings &gt; Custom Code &gt; Add Code &gt; paste in Body (end)</li>
                                    <li><span className="font-medium text-foreground">Squarespace</span> — Settings &gt; Advanced &gt; Code Injection &gt; Footer</li>
                                    <li><span className="font-medium text-foreground">Webflow</span> — Project Settings &gt; Custom Code &gt; Footer Code</li>
                                    <li><span className="font-medium text-foreground">Shopify</span> — Online Store &gt; Themes &gt; Edit Code &gt; theme.liquid (before &lt;/body&gt;)</li>
                                </ul>
                            </div>

                            <div className="text-xs text-muted-foreground pt-2 border-t border-border/50">
                                <p className="font-medium text-foreground mb-1.5">Using an AI website builder? (Framer, Durable, B12, 10Web, etc.)</p>
                                <p className="mb-1.5">Most AI builders don&apos;t have a &quot;custom code&quot; section. Instead, give your AI tool this prompt:</p>
                                <div className="bg-background border rounded-lg p-2.5 mb-1.5 font-mono text-[11px] leading-relaxed select-all">
                                    Add this tracking script to the footer of my website, right before the closing &lt;/body&gt; tag. It should load on every page. Do not modify the script — paste it exactly as-is: [PASTE YOUR SCRIPT HERE]
                                </div>
                                <p>If your AI builder has a &quot;Custom Code&quot;, &quot;Embed&quot;, or &quot;HTML block&quot; option, use that instead. Some builders to check:</p>
                                <ul className="space-y-0.5 mt-1">
                                    <li><span className="font-medium text-foreground">Framer</span> — Site Settings &gt; General &gt; Custom Code &gt; End of &lt;body&gt;</li>
                                    <li><span className="font-medium text-foreground">Durable</span> — Ask the AI: &quot;Add this script to the footer of my site&quot;</li>
                                    <li><span className="font-medium text-foreground">Hostinger Website Builder</span> — Settings &gt; Custom Code &gt; Body section</li>
                                    <li><span className="font-medium text-foreground">Carrd</span> — Add an Embed element &gt; Type: Code &gt; Head/Body</li>
                                </ul>
                            </div>

                            <div className="text-xs text-muted-foreground pt-2 border-t border-border/50">
                                <p className="font-medium text-foreground mb-1">What gets captured:</p>
                                <p>Every field in your form — name, email, phone, company, budget, or any custom fields. Your form keeps working normally. Visitors won&apos;t notice any change.</p>
                            </div>
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                                    <Code className="h-3.5 w-3.5" />
                                    Tracking Script
                                </span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-xs"
                                    onClick={() => copyToClipboard(snippetCode!)}
                                >
                                    {copied ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                                    {copied ? "Copied!" : "Copy Script"}
                                </Button>
                            </div>
                            <pre className="bg-muted rounded-lg p-3 text-xs font-mono overflow-x-auto max-h-[200px] overflow-y-auto border">
                                <code>{snippetCode}</code>
                            </pre>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 border-green-200 dark:border-green-800">
                                Active
                            </Badge>
                            <code className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{keyPrefix}</code>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            Your tracking script is active. If you need a new script, generate a fresh one below.
                        </p>
                        <Button variant="outline" size="sm" onClick={handleSetup} disabled={generating}>
                            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${generating ? "animate-spin" : ""}`} />
                            {generating ? "Generating…" : "Generate new script"}
                        </Button>
                    </div>
                )}
        </div>
    )
}

function generateTrackingSnippet(webhookUrl: string, apiKey: string): string {
    return `<!-- Vesta CRM Lead Tracking -->
<script>
(function(){
  var VESTA_URL='${webhookUrl}';
  var VESTA_KEY='${apiKey}';

  function hasEmail(form){
    var inputs=form.querySelectorAll('input[type="email"],input[name*="email" i],input[placeholder*="email" i]');
    for(var i=0;i<inputs.length;i++){if(inputs[i].value&&inputs[i].value.includes('@'))return true;}
    return false;
  }

  function getLabel(el){
    if(el.id){var l=document.querySelector('label[for="'+el.id+'"]');if(l)return l.textContent.trim();}
    var p=el.closest('label');if(p)return p.textContent.replace(el.value,'').trim();
    return null;
  }

  document.addEventListener('submit',function(e){
    var form=e.target;
    if(!form||form.tagName!=='FORM')return;
    if(!hasEmail(form))return;

    var fields={};
    var els=form.querySelectorAll('input,select,textarea');
    for(var i=0;i<els.length;i++){
      var el=els[i];
      if(el.type==='hidden'||el.type==='submit'||el.type==='button'||el.type==='password')continue;
      if(el.type==='checkbox'&&!el.checked)continue;
      if(el.type==='radio'&&!el.checked)continue;
      var val=el.type==='checkbox'?'Yes':el.value;
      if(!val||!val.trim())continue;
      var key=el.name||el.id||getLabel(el)||el.placeholder||('field_'+i);
      key=key.replace(/[^a-zA-Z0-9_-]/g,'_').toLowerCase();
      fields[key]=val.trim();
    }

    fields.utm_source=new URLSearchParams(location.search).get('utm_source');
    fields.utm_medium=new URLSearchParams(location.search).get('utm_medium');
    fields.utm_campaign=new URLSearchParams(location.search).get('utm_campaign');
    fields.page_url=location.href;
    fields.page_title=document.title;

    navigator.sendBeacon?
      navigator.sendBeacon(VESTA_URL,new Blob([JSON.stringify({...fields,_auth:VESTA_KEY})],{type:'application/json'})):
      fetch(VESTA_URL,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+VESTA_KEY},body:JSON.stringify(fields),keepalive:true});
  },true);
})();
</script>`
}
