'use client';

import { useState } from 'react';

export default function ContactPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [isError, setIsError] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setStatusMessage('');
    setIsError(false);

    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData);

    try {
      const response = await fetch('https://formspree.io/f/mqawknwn', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      const responseData = await response.json().catch(() => ({}));
      
      // Formspree always returns 200, check the response body
      if ((responseData as any).ok === true || response.status === 200) {
        setStatusMessage("Message sent! I'll get back to you within 24 hours.");
        e.currentTarget.reset();
      } else {
        setIsError(true);
        setStatusMessage('Failed to send message. Please try again or email plumbmonkey@proton.me');
      }
    } catch (error) {
      console.error('Form submission error:', error);
      setIsError(true);
      setStatusMessage('An error occurred. Please try again or email plumbmonkey@proton.me');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="min-h-screen py-24 bg-zinc-950 text-zinc-50">
      <div className="container mx-auto px-6">
        <h1 className="text-4xl font-bold mb-12 text-center">Get in Touch</h1>
        <div className="max-w-2xl mx-auto">
          <form onSubmit={handleSubmit} className="space-y-6">
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
            {statusMessage && (
              <div className={`p-4 rounded ${isError ? 'bg-red-900/20 text-red-300' : 'bg-teal-900/20 text-teal-300'}`}>
                {statusMessage}
              </div>
            )}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full px-6 py-3 bg-teal-600 text-white font-semibold rounded hover:bg-teal-500 transition disabled:opacity-50"
            >
              {isSubmitting ? 'Sending...' : 'Send Message'}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
