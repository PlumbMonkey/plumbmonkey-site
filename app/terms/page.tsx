import type { Metadata } from "next";
import Link from "next/link";
import LegalPage from "../components/LegalPage";

export const metadata: Metadata = {
  title: "Terms of Use",
  description: "The terms for using the 3D Product Rotator app, including how the weekly subscription works.",
};

const EMAIL = "plumbmonkey@gmail.com";

export default function TermsPage() {
  return (
    <LegalPage title="Terms of use" updated="October 2, 2026">
      <p>
        These terms apply to the <strong>3D Product Rotator</strong> app (“the app”), provided by
        Plumbmonkey Media (“Plumbmonkey”, “we”), Calgary, Alberta, Canada. By installing or using the
        app you agree to them. If you don’t agree, please don’t use the app. How we handle your
        information is in our <Link href="/privacy">privacy policy</Link>.
      </p>

      <h2>What the app does</h2>
      <p>
        The app turns product photos or 3D models into a turning “spin” you can save as a video or
        GIF. The work happens on your device.
      </p>

      <h2>Subscription and billing</h2>
      <ul>
        <li>
          The app is free to download. Using it requires an active <strong>auto-renewing weekly
          subscription</strong>. The price, billing period and any free trial are shown on the purchase
          screen before you subscribe.
        </li>
        <li>Payment is charged to your Google Play account at confirmation of purchase.</li>
        <li>
          Your subscription renews automatically at the end of each period unless you cancel at least
          24 hours before it ends. If a free trial is offered and you don’t cancel before it ends, you
          will be charged the subscription price.
        </li>
        <li>
          You can manage or cancel anytime in Google Play (Play Store → profile → Payments &amp;
          subscriptions) or from <strong>Settings → Manage subscription</strong> in the app. Deleting
          the app does not cancel your subscription.
        </li>
        <li>
          Refunds are handled by Google Play under its refund policy. Nothing here limits any refund
          right you have under the law where you live.
        </li>
        <li>
          <strong>Restore purchases</strong> in the app re-activates a subscription you already hold,
          for example on a new phone.
        </li>
      </ul>

      <h2>Your content</h2>
      <ul>
        <li>
          Your photos, models and the spins made from them belong to you. We don’t get any rights to
          them, and they are not uploaded to us.
        </li>
        <li>
          You are responsible for having the right to use whatever you photograph or open in the app,
          including products, logos and 3D models made by others.
        </li>
        <li>Please don’t use the app to make unlawful, deceptive or infringing content.</li>
      </ul>

      <h2>Licence</h2>
      <p>
        We give you a personal, non-exclusive, non-transferable licence to use the app on your own
        devices while your subscription is active and for your own business or personal use. You may
        not copy, reverse-engineer or resell the app, or remove its notices, except where the law
        allows it despite this clause.
      </p>

      <h2>Quality of results</h2>
      <p>
        Results depend on your photos and models. Cut-outs on cluttered or low-contrast backgrounds,
        and smoothness between photos taken at uneven angles, may not be perfect. We work to improve
        these but can’t promise any particular result.
      </p>

      <h2>Custom 3D models</h2>
      <p>
        The app links to a service where you can ask Plumbmonkey to build a custom 3D model. That
        work is a separate engagement with its own quote and terms. Using the link doesn’t commit you
        to anything.
      </p>

      <h2>Third-party services</h2>
      <p>
        The app relies on Google Play for billing and on other providers listed in the privacy policy.
        Their own terms apply to the services they provide.
      </p>

      <h2>Availability and changes</h2>
      <p>
        We may update, change or discontinue features. If we make a change that significantly reduces
        what you paid for, you may cancel your subscription and ask for a fair refund for the unused
        period. We may update these terms; the date above shows the latest version, and continued use
        after a change means you accept it.
      </p>

      <h2>Warranties and liability</h2>
      <p>
        The app is provided “as is”, without promises that it will be uninterrupted or error-free.
        To the extent allowed by law, Plumbmonkey is not liable for indirect or consequential losses,
        such as lost sales or profit, and our total liability for any claim is limited to what you paid
        for the app in the 12 months before the claim. Nothing in these terms limits liability that
        cannot be limited by law, or any right you have under consumer protection law where you live,
        including in Québec.
      </p>

      <h2>Ending your use</h2>
      <p>
        You can stop using the app at any time by cancelling your subscription and uninstalling it. We
        may suspend access if you seriously breach these terms.
      </p>

      <h2>Governing law</h2>
      <p>
        These terms are governed by the laws of Alberta and the federal laws of Canada that apply
        there, subject to any mandatory consumer-protection rules of the province or country where you
        live. If you live in Québec, nothing here deprives you of the protection of Québec law or the
        right to bring a claim in the courts of your home district.
      </p>

      <h2>Contact</h2>
      <p>
        Plumbmonkey Media, Calgary, Alberta, Canada · <a href={`mailto:${EMAIL}`}>{EMAIL}</a>
      </p>
    </LegalPage>
  );
}
