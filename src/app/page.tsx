import Link from "next/link";
import { 
  BookOpen, 
  Brain, 
  Key, 
  Sparkles, 
  UploadCloud, 
  Share2, 
  ArrowRight, 
  CheckCircle, 
  Database, 
  Cpu, 
  Layers, 
  GraduationCap, 
  FileText, 
  BarChart3, 
  MessageSquare,
  ShieldCheck
} from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#f8f9ff] text-[#0b1c30] font-sans selection:bg-indigo-100 selection:text-indigo-900">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#f8f9ff]/80 backdrop-blur-md border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="bg-indigo-600 text-white p-2 rounded-lg shadow-sm shadow-indigo-500/20">
              <Brain className="w-5 h-5" />
            </div>
            <span className="font-bold text-xl tracking-tight text-slate-900">
              NoteHut
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <a href="#features" className="hover:text-indigo-600 transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-indigo-600 transition-colors">How It Works</a>
            <a href="#byok" className="hover:text-indigo-600 transition-colors">BYOK Architecture</a>
            <a href="#tech-stack" className="hover:text-indigo-600 transition-colors">Tech Stack</a>
          </nav>

          <div className="flex items-center gap-4">
            <Link 
              href="/login" 
              className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors px-3 py-2 rounded-md"
            >
              Sign In
            </Link>
            <Link 
              href="/register" 
              className="bg-slate-900 text-white hover:bg-slate-800 text-sm font-medium px-4 py-2 rounded-lg transition-all shadow-sm"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-20 pb-24 overflow-hidden">
        {/* Background decorative elements */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-full pointer-events-none">
          <div className="absolute top-12 left-10 w-72 h-72 bg-indigo-200/30 rounded-full blur-3xl" />
          <div className="absolute top-40 right-10 w-80 h-80 bg-blue-200/20 rounded-full blur-3xl" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-1.5 bg-indigo-50 border border-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-xs font-semibold mb-6 tracking-wide uppercase">
              <Sparkles className="w-3.5 h-3.5" />
              Next-Gen AI Study Platform
            </div>
            
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-slate-900 leading-[1.1] mb-6">
              Adaptive AI Document Analysis & Exam Builder
            </h1>
            
            <p className="text-lg sm:text-xl text-slate-600 mb-10 leading-relaxed">
              Upload your study materials, generate custom exams, and let our adaptive AI target your weaknesses. Bring your own keys (BYOK) for complete control over your data and costs.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
              <Link 
                href="/register" 
                className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-8 py-3.5 rounded-xl transition-all shadow-md shadow-indigo-500/10 flex items-center justify-center gap-2 group"
              >
                Start Studying Free
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link 
                href="/login" 
                className="w-full sm:w-auto bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-medium px-8 py-3.5 rounded-xl transition-all flex items-center justify-center gap-2"
              >
                Go to Dashboard
              </Link>
            </div>
          </div>

          {/* Interactive Mockup */}
          <div className="max-w-5xl mx-auto bg-white rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/50 overflow-hidden">
            <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-rose-400" />
                <div className="w-3 h-3 rounded-full bg-amber-400" />
                <div className="w-3 h-3 rounded-full bg-emerald-400" />
                <span className="text-xs font-medium text-slate-400 ml-2 font-mono">notehut-workspace</span>
              </div>
              <div className="bg-slate-200/60 text-slate-600 text-xs px-3 py-1 rounded-md font-mono flex items-center gap-1.5">
                <Key className="w-3 h-3 text-indigo-600" />
                BYOK: Ollama (qwen3-embedding)
              </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 min-h-[400px]">
              {/* Left Panel: Document Upload & Topics */}
              <div className="lg:col-span-4 p-6 bg-slate-50/50 flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-indigo-600" />
                    Topics & Documents
                  </h3>
                  <div className="space-y-2.5">
                    <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <FileText className="w-4 h-4 text-indigo-500" />
                        <span className="text-xs font-medium text-slate-700">Biology_Ch3_Genetics.pdf</span>
                      </div>
                      <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-medium">Processed</span>
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <FileText className="w-4 h-4 text-indigo-500" />
                        <span className="text-xs font-medium text-slate-700">Organic_Chemistry_Notes.pdf</span>
                      </div>
                      <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-medium">Processed</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 border-2 border-dashed border-slate-200 rounded-xl p-6 text-center bg-white">
                  <UploadCloud className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-xs font-medium text-slate-700">Drag & drop study files</p>
                  <p className="text-[10px] text-slate-400 mt-1">PDF, DOCX, or TXT up to 10MB</p>
                </div>
              </div>

              {/* Middle Panel: Exam Runner */}
              <div className="lg:col-span-5 p-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                      <GraduationCap className="w-4 h-4 text-indigo-600" />
                      Adaptive Exam Runner
                    </h3>
                    <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-semibold">Question 3 of 10</span>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-4">
                    <p className="text-xs font-medium text-slate-800 leading-relaxed">
                      Which of the following best describes the primary function of DNA polymerase during replication?
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="border border-slate-200 rounded-lg p-3 text-xs text-slate-700 hover:bg-slate-50 cursor-pointer transition-colors flex items-center gap-2.5">
                      <div className="w-4 h-4 rounded-full border border-slate-300 flex items-center justify-center text-[9px] font-bold">A</div>
                      Unwinding the double helix structure
                    </div>
                    <div className="border-2 border-indigo-600 bg-indigo-50/30 rounded-lg p-3 text-xs text-slate-900 cursor-pointer transition-colors flex items-center gap-2.5">
                      <div className="w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[9px] font-bold">B</div>
                      Synthesizing new DNA strands by adding nucleotides
                    </div>
                    <div className="border border-slate-200 rounded-lg p-3 text-xs text-slate-700 hover:bg-slate-50 cursor-pointer transition-colors flex items-center gap-2.5">
                      <div className="w-4 h-4 rounded-full border border-slate-300 flex items-center justify-center text-[9px] font-bold">C</div>
                      Synthesizing RNA primers to initiate replication
                    </div>
                  </div>
                </div>

                <div className="flex justify-end mt-6">
                  <button className="bg-indigo-600 text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors">
                    Submit Answer
                  </button>
                </div>
              </div>

              {/* Right Panel: Weakness Tracking */}
              <div className="lg:col-span-3 p-6 bg-slate-50/30 flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-indigo-600" />
                    Weakness Analytics
                  </h3>
                  <p className="text-[11px] text-slate-500 mb-4 leading-relaxed">
                    AI automatically tracks incorrect answers and adapts future exams to focus on these topics.
                  </p>

                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-[10px] font-medium text-slate-600 mb-1">
                        <span>DNA Replication</span>
                        <span className="text-rose-600 font-semibold">4 errors</span>
                      </div>
                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-rose-500 h-full rounded-full" style={{ width: "80%" }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-[10px] font-medium text-slate-600 mb-1">
                        <span>Transcription Factors</span>
                        <span className="text-amber-600 font-semibold">2 errors</span>
                      </div>
                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-amber-500 h-full rounded-full" style={{ width: "40%" }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-[10px] font-medium text-slate-600 mb-1">
                        <span>Mendelian Genetics</span>
                        <span className="text-emerald-600 font-semibold">0 errors</span>
                      </div>
                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-emerald-500 h-full rounded-full" style={{ width: "5%" }} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 mt-6">
                  <div className="flex gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-indigo-800 leading-relaxed">
                      <strong>AI Bias Active:</strong> Next exam will contain 40% more questions on <em>DNA Replication</em>.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-white border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl mb-4">
              Everything You Need to Master Your Studies
            </h2>
            <p className="text-lg text-slate-600">
              NoteHut combines advanced document processing, semantic search, and adaptive learning algorithms to create the ultimate study companion.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-[#f8f9ff] p-8 rounded-xl border border-slate-200/60 hover:border-indigo-200 transition-all hover:shadow-md hover:shadow-indigo-500/5">
              <div className="bg-indigo-600 text-white p-3 rounded-lg w-fit mb-6">
                <Brain className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-3">Adaptive Exam Generation</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Generate custom exams featuring multiple-choice, checkbox, and essay questions. The system automatically biases questions toward your weak areas to maximize study efficiency.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-[#f8f9ff] p-8 rounded-xl border border-slate-200/60 hover:border-indigo-200 transition-all hover:shadow-md hover:shadow-indigo-500/5">
              <div className="bg-indigo-600 text-white p-3 rounded-lg w-fit mb-6">
                <Key className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-3">Bring Your Own Key (BYOK)</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Connect your own Ollama or OpenAI-compatible API key. Your keys are stored securely in your browser&apos;s local storage, giving you complete control over privacy and costs.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-[#f8f9ff] p-8 rounded-xl border border-slate-200/60 hover:border-indigo-200 transition-all hover:shadow-md hover:shadow-indigo-500/5">
              <div className="bg-indigo-600 text-white p-3 rounded-lg w-fit mb-6">
                <MessageSquare className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-3">Interactive AI Tutor</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Chat with an AI tutor that has full semantic access to your uploaded documents. Ask questions, request summaries, or get step-by-step explanations of complex concepts.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="bg-[#f8f9ff] p-8 rounded-xl border border-slate-200/60 hover:border-indigo-200 transition-all hover:shadow-md hover:shadow-indigo-500/5">
              <div className="bg-indigo-600 text-white p-3 rounded-lg w-fit mb-6">
                <Layers className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-3">Multi-File Topics</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Organize your study materials into unified Topics. Upload multiple PDFs, DOCX, or TXT files per topic and run comprehensive RAG queries across all of them simultaneously.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="bg-[#f8f9ff] p-8 rounded-xl border border-slate-200/60 hover:border-indigo-200 transition-all hover:shadow-md hover:shadow-indigo-500/5">
              <div className="bg-indigo-600 text-white p-3 rounded-lg w-fit mb-6">
                <Share2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-3">Public Exam Sharing</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Share your custom-generated exams with classmates or students via a public link. Guests can take the exam and get graded instantly with built-in rate limiting protection.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="bg-[#f8f9ff] p-8 rounded-xl border border-slate-200/60 hover:border-indigo-200 transition-all hover:shadow-md hover:shadow-indigo-500/5">
              <div className="bg-indigo-600 text-white p-3 rounded-lg w-fit mb-6">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-3">Secure Admin Controls</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                System administrators can monitor the background OCR queue, configure fallback API keys, and manage global application settings through a secure, masked dashboard.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-24 bg-[#f8f9ff]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl mb-4">
              How NoteHut Works
            </h2>
            <p className="text-lg text-slate-600">
              Three simple steps to transform raw study materials into structured, long-term knowledge.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 relative">
            {/* Step 1 */}
            <div className="text-center relative">
              <div className="bg-white border border-slate-200 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm text-xl font-bold text-indigo-600">
                1
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-3">Upload Study Materials</h3>
              <p className="text-sm text-slate-600 leading-relaxed max-w-xs mx-auto">
                Upload PDFs, Word documents, or text files. Our pipeline extracts text, chunks it recursively, and generates vector embeddings.
              </p>
            </div>

            {/* Step 2 */}
            <div className="text-center relative">
              <div className="bg-white border border-slate-200 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm text-xl font-bold text-indigo-600">
                2
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-3">Generate Custom Exams</h3>
              <p className="text-sm text-slate-600 leading-relaxed max-w-xs mx-auto">
                Configure your exam settings (MCQ, checkbox, essay) and let our RAG pipeline generate highly relevant, context-grounded questions.
              </p>
            </div>

            {/* Step 3 */}
            <div className="text-center relative">
              <div className="bg-white border border-slate-200 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm text-xl font-bold text-indigo-600">
                3
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-3">Master Your Weaknesses</h3>
              <p className="text-sm text-slate-600 leading-relaxed max-w-xs mx-auto">
                Submit your answers for instant grading. The system tracks your incorrect answers and adapts future exams to target those specific topics.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* BYOK Section */}
      <section id="byok" className="py-24 bg-white border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-slate-900 rounded-2xl text-white p-8 sm:p-12 lg:p-16 relative overflow-hidden shadow-xl">
            <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
            
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-10">
              <div className="lg:col-span-7">
                <div className="inline-flex items-center gap-1.5 bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 px-3 py-1 rounded-full text-xs font-semibold mb-6 uppercase tracking-wider">
                  <Key className="w-3.5 h-3.5" />
                  Bring Your Own Key (BYOK)
                </div>
                <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-6">
                  Complete Control Over Your AI Costs & Privacy
                </h2>
                <p className="text-slate-300 text-base sm:text-lg mb-8 leading-relaxed">
                  Unlike traditional SaaS platforms that charge heavy markups on AI usage, NoteHut operates on a BYOK architecture. Connect your local Ollama instance or input your own OpenAI-compatible API keys. 
                </p>
                <ul className="space-y-3.5 text-sm text-slate-300">
                  <li className="flex items-center gap-2.5">
                    <CheckCircle className="w-5 h-5 text-indigo-400 shrink-0" />
                    <span><strong>Zero Markup:</strong> Pay only what the AI provider charges, or run completely free locally.</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle className="w-5 h-5 text-indigo-400 shrink-0" />
                    <span><strong>Local Embeddings:</strong> Default support for Ollama&apos;s <code>qwen3-embedding:0.6b</code>.</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle className="w-5 h-5 text-indigo-400 shrink-0" />
                    <span><strong>Secure Storage:</strong> Keys are stored locally in your browser&apos;s via Zustand and never touch our servers.</span>
                  </li>
                </ul>
              </div>

              <div className="lg:col-span-5 bg-slate-800/50 border border-slate-700 rounded-xl p-6 sm:p-8">
                <h3 className="text-base font-bold mb-4 flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-indigo-400" />
                  Supported Providers
                </h3>
                <div className="space-y-3">
                  <div className="bg-slate-900/60 border border-slate-700/50 p-3.5 rounded-lg flex items-center justify-between">
                    <span className="text-sm font-medium">Ollama (Local AI)</span>
                    <span className="text-xs bg-indigo-500/20 text-indigo-300 px-2.5 py-0.5 rounded-full font-semibold">Free & Local</span>
                  </div>
                  <div className="bg-slate-900/60 border border-slate-700/50 p-3.5 rounded-lg flex items-center justify-between">
                    <span className="text-sm font-medium">OpenAI (GPT-4o, GPT-4o-mini)</span>
                    <span className="text-xs bg-slate-700 text-slate-300 px-2.5 py-0.5 rounded-full font-semibold">Cloud API</span>
                  </div>
                  <div className="bg-slate-900/60 border border-slate-700/50 p-3.5 rounded-lg flex items-center justify-between">
                    <span className="text-sm font-medium">Anthropic (Claude 3.5 Sonnet)</span>
                    <span className="text-xs bg-slate-700 text-slate-300 px-2.5 py-0.5 rounded-full font-semibold">Cloud API</span>
                  </div>
                  <div className="bg-slate-900/60 border border-slate-700/50 p-3.5 rounded-lg flex items-center justify-between">
                    <span className="text-sm font-medium">Google Gemini (Gemini 1.5 Pro)</span>
                    <span className="text-xs bg-slate-700 text-slate-300 px-2.5 py-0.5 rounded-full font-semibold">Cloud API</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tech Stack Section */}
      <section id="tech-stack" className="py-24 bg-[#f8f9ff] border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl mb-4">
              Built on a Modern, Scalable Stack
            </h2>
            <p className="text-lg text-slate-600">
              NoteHut leverages cutting-edge technologies to deliver a fast, secure, and highly responsive user experience.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200/60 text-center flex flex-col items-center justify-center shadow-sm">
              <div className="bg-indigo-50 text-indigo-600 p-3 rounded-lg mb-4">
                <Layers className="w-6 h-6" />
              </div>
              <span className="text-sm font-bold text-slate-900">Next.js 15</span>
              <span className="text-[10px] text-slate-400 mt-1">App Router & Turbopack</span>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200/60 text-center flex flex-col items-center justify-center shadow-sm">
              <div className="bg-indigo-50 text-indigo-600 p-3 rounded-lg mb-4">
                <Cpu className="w-6 h-6" />
              </div>
              <span className="text-sm font-bold text-slate-900">React 19</span>
              <span className="text-[10px] text-slate-400 mt-1">Concurrent Rendering</span>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200/60 text-center flex flex-col items-center justify-center shadow-sm">
              <div className="bg-indigo-50 text-indigo-600 p-3 rounded-lg mb-4">
                <Database className="w-6 h-6" />
              </div>
              <span className="text-sm font-bold text-slate-900">Supabase</span>
              <span className="text-[10px] text-slate-400 mt-1">Auth, DB, & Storage</span>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200/60 text-center flex flex-col items-center justify-center shadow-sm">
              <div className="bg-indigo-50 text-indigo-600 p-3 rounded-lg mb-4">
                <Database className="w-6 h-6" />
              </div>
              <span className="text-sm font-bold text-slate-900">pgvector</span>
              <span className="text-[10px] text-slate-400 mt-1">Vector Embeddings</span>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200/60 text-center flex flex-col items-center justify-center shadow-sm">
              <div className="bg-indigo-50 text-indigo-600 p-3 rounded-lg mb-4">
                <Key className="w-6 h-6" />
              </div>
              <span className="text-sm font-bold text-slate-900">Zustand</span>
              <span className="text-[10px] text-slate-400 mt-1">Local State Persist</span>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200/60 text-center flex flex-col items-center justify-center shadow-sm">
              <div className="bg-indigo-50 text-indigo-600 p-3 rounded-lg mb-4">
                <Sparkles className="w-6 h-6" />
              </div>
              <span className="text-sm font-bold text-slate-900">AI SDK v7</span>
              <span className="text-[10px] text-slate-400 mt-1">Unified AI Streaming</span>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-24 bg-white border-t border-slate-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl mb-6">
            Ready to Supercharge Your Learning?
          </h2>
          <p className="text-lg text-slate-600 mb-10 max-w-2xl mx-auto">
            Join NoteHut today and experience the power of adaptive, AI-driven study tools with complete privacy and cost control.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link 
              href="/register" 
              className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-8 py-3.5 rounded-xl transition-all shadow-md shadow-indigo-500/10 flex items-center justify-center gap-2 group"
            >
              Create Free Account
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link 
              href="/login" 
              className="w-full sm:w-auto bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 font-medium px-8 py-3.5 rounded-xl transition-all flex items-center justify-center gap-2"
            >
              Sign In to NoteHut
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-12 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2.5">
              <div className="bg-indigo-600 text-white p-1.5 rounded-md">
                <Brain className="w-4 h-4" />
              </div>
              <span className="font-bold text-lg tracking-tight text-white">
                NoteHut
              </span>
            </div>
            <p className="text-xs text-slate-500">
              &copy; {new Date().getFullYear()} NoteHut. All rights reserved. Built with Next.js 15, Supabase, and pgvector.
            </p>
            <div className="flex gap-6 text-xs">
              <a href="#features" className="hover:text-white transition-colors">Features</a>
              <a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a>
              <a href="#byok" className="hover:text-white transition-colors">BYOK</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
