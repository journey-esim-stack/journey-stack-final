// Update this page (the content is just a fallback if you fail to update the page)

const Index = () => {
  // Basic SEO
  if (typeof document !== 'undefined') {
    document.title = 'Journey eSIM Agent Portal – Home';
    const d = document.querySelector('meta[name="description"]');
    if (d) d.setAttribute('content', 'Agent portal to browse eSIM plans, set pricing, manage wallet, and create activations.');
  }

  return (
    <main className="min-h-screen bg-gradient-subtle">
      <header className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="text-2xl font-bold text-primary">Journey</div>
            <div className="text-2xl font-bold text-foreground">Stack</div>
          </div>
          <a 
            href="/auth" 
            className="rounded-lg bg-primary px-6 py-2 text-sm font-medium text-primary-foreground shadow-orange transition-all hover:shadow-lg hover:shadow-orange/50"
          >
            Agent Portal
          </a>
        </div>
      </header>
      
      <section className="container mx-auto max-w-4xl px-4 py-20 text-center">
        <div className="mb-6 inline-flex items-center rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
          <span className="mr-2 h-2 w-2 rounded-full bg-primary"></span>
          What's new: Announcing our latest $2M Seed-A
        </div>
        
        <h1 className="mb-6 text-5xl font-bold leading-tight">
          Unrivalled eSIM Platform for{" "}
          <span className="text-primary">Travel Agents.</span>
        </h1>
        
        <p className="mb-10 text-xl text-muted-foreground max-w-3xl mx-auto">
          Embed Journey eSIM into your travel platform - offer agents instant global data in 190+ countries with one-link activation, direct MNO quality, 30–40% cheaper rates, zero minimums.
        </p>
        
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a 
            href="/auth" 
            className="inline-flex h-12 items-center justify-center rounded-lg bg-primary px-8 text-base font-medium text-primary-foreground shadow-orange transition-all hover:shadow-lg hover:shadow-orange/50"
          >
            Get Started
          </a>
          <a 
            href="https://forms.gle/jQ9v2dWWerj71Hwr6" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex h-12 items-center justify-center rounded-lg border border-border bg-background px-8 text-base font-medium text-foreground transition-all hover:bg-accent"
          >
            Book a call
          </a>
        </div>
        
        <div className="mt-16 flex items-center justify-center space-x-8 text-sm text-muted-foreground">
          <div className="text-center">
            <div className="text-2xl font-bold text-foreground">10+</div>
            <div>Travel Partners</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-foreground">6,000+</div>
            <div>eSIMs sold</div>
          </div>
        </div>
      </section>
    </main>
  );
};

export default Index;
