'use client';

export default function ContactPage() {
  return (
    <section className="min-h-screen py-24 bg-zinc-950 text-zinc-50">
      <div className="container mx-auto px-6">
        <h1 className="text-4xl font-bold mb-12 text-center">Get in Touch</h1>
        <div className="max-w-2xl mx-auto">
          <form action="https://formspree.io/f/xjkrragg" method="POST" className="space-y-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-2">
                Name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                className="w-full px-4 py-2 rounded bg-zinc-800 border border-zinc-700 text-zinc-50 focus:outline-none focus:border-teal-500"
              />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-2">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="w-full px-4 py-2 rounded bg-zinc-800 border border-zinc-700 text-zinc-50 focus:outline-none focus:border-teal-500"
              />
            </div>
            <div>
              <label htmlFor="message" className="block text-sm font-medium mb-2">
                Message
              </label>
              <textarea
                id="message"
                name="message"
                rows={6}
                required
                className="w-full px-4 py-2 rounded bg-zinc-800 border border-zinc-700 text-zinc-50 focus:outline-none focus:border-teal-500"
              ></textarea>
            </div>
            <button
              type="submit"
              className="w-full px-6 py-3 bg-teal-600 text-white font-semibold rounded hover:bg-teal-500 transition"
            >
              Send Message
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
