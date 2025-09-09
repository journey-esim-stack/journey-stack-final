// Update this page (the content is just a fallback if you fail to update the page)

const Index = () => {
  // Basic SEO
  if (typeof document !== 'undefined') {
    document.title = 'Journey eSIM Agent Portal – Home';
    const d = document.querySelector('meta[name="description"]');
    if (d) d.setAttribute('content', 'Agent portal to browse eSIM plans, set pricing, manage wallet, and create activations.');
  }

  return (
    <main className="min-h-screen bg-background">
      <section className="container mx-auto max-w-3xl px-4 py-20 text-center">
        <h1 className="mb-4 text-4xl font-bold">Journey eSIM Agent Portal</h1>
        <p className="mb-8 text-lg text-muted-foreground">
          Onboard as a travel agent, set your retail prices, manage wallet balance, and create eSIMs for travelers.
        </p>
        <div className="flex items-center justify-center gap-4">
          <a href="/auth" className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
            Sign In / Sign Up
          </a>
        </div>
      </section>
    </main>
  );
};

export default Index;
