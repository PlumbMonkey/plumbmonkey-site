import type { Metadata } from "next";
import LegalPage from "../components/LegalPage";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How the 3D Product Rotator app handles your data: photos stay on your device, analytics are optional and off by default.",
};

const EMAIL = "plumbmonkey@gmail.com";

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy" updated="October 2, 2026">
      <p>
        This policy explains what the <strong>3D Product Rotator</strong> app (“the app”) does with
        your information. It is written to meet Canada’s <em>PIPEDA</em> and Québec’s{" "}
        <em>Law 25</em>. The app is operated by Plumbmonkey Media (“Plumbmonkey”, “we”), based in
        Calgary, Alberta, Canada.
      </p>

      <h2>The short version</h2>
      <ul>
        <li>
          <strong>Your photos and 3D models never leave your phone.</strong> The app makes the spin on
          your device. We have no servers that receive your pictures.
        </li>
        <li>
          <strong>Analytics are optional and off by default.</strong> They only start if you switch them
          on, and you can switch them off at any time.
        </li>
        <li>
          We don’t ask for your name, email, contacts, location or advertising ID.
        </li>
        <li>
          You can erase everything the app stores in <strong>Settings → Delete all my data</strong>.
        </li>
      </ul>

      <h2>Privacy Officer</h2>
      <p>
        Gregg Henwood, owner of Plumbmonkey Media, is our designated Privacy Officer (the person
        responsible for protecting personal information). Contact:{" "}
        <a href={`mailto:${EMAIL}`}>{EMAIL}</a>.
      </p>

      <h2>What stays on your device</h2>
      <ul>
        <li>The photos you take or choose, and the 3D models you open.</li>
        <li>The finished spins, videos and GIFs the app creates, which are kept in the app’s private storage.</li>
        <li>
          The cut-out masks created when you use “Smart cut-out”. These are computed on your device by
          Google’s ML Kit; your pictures are not sent to Google for this.
        </li>
        <li>
          A small record of your privacy choices (which options you allowed, the policy version, and
          when you decided). We keep it so we can show that consent was given.
        </li>
      </ul>
      <p>
        A file leaves your device only when <em>you</em> share or save it, for example by sending a
        video to another app.
      </p>

      <h2>What we collect, and why</h2>

      <h3>1. Subscription and purchase information (needed to provide the app)</h3>
      <p>
        The app is unlocked by a subscription. Payment is handled by <strong>Google Play</strong>; we
        never see your card details. We use <strong>RevenueCat</strong> to confirm whether your
        subscription is active. RevenueCat receives a random app user ID and your purchase receipt
        from Google. It does not receive your name or email from us.
      </p>

      <h3>2. Usage analytics (only if you say yes)</h3>
      <p>
        If you turn on “Product analytics”, the app sends anonymous events to <strong>PostHog</strong>{" "}
        (hosted in the European Union) so we can see what works and fix what doesn’t. The events are:
      </p>
      <ul>
        <li>app opened, installed, updated or sent to the background (standard app events);</li>
        <li>paywall viewed, trial started, purchase completed or restored;</li>
        <li>render started, completed (with how long it took and the number of frames) or failed;</li>
        <li>a video or GIF exported (and in which format);</li>
        <li>the “commission a custom 3D model” link tapped.</li>
      </ul>
      <p>
        Each event is linked to a random ID created on your phone, not to you. Like most apps, PostHog
        also receives basic technical details with each event, such as app version, operating system
        version and device type. We do not use session recording, we do not track what is on your
        screen, and we do not send your photos, models, file names or any text you type. We have
        configured PostHog not to store IP addresses.
      </p>

      <h3>3. Crash reports and product updates</h3>
      <p>
        The privacy screen lists “Crash diagnostics” and “Product updates”. <strong>Neither is in use
        yet</strong>: no crash reports are sent and no news or offers are delivered. If that changes
        we will update this policy and ask for your consent again before using them.
      </p>

      <h3>4. Camera</h3>
      <p>
        If you use “Guided capture”, the app asks for camera permission. Pictures taken are saved in
        the app’s private storage on your device only.
      </p>

      <h2>Who else handles data, and where</h2>
      <ul>
        <li>
          <strong>Google Play</strong> (billing and app delivery). Governed by Google’s own privacy
          policy.
        </li>
        <li>
          <strong>RevenueCat</strong> (subscription status), United States.
        </li>
        <li>
          <strong>PostHog</strong> (analytics, only with your consent), European Union.
        </li>
        <li>
          <strong>Google ML Kit</strong>: on first use of Smart cut-out, Google Play services may
          download the cut-out model to your phone. This is a download to you; your photos are not
          uploaded.
        </li>
      </ul>
      <p>
        Because some of these providers are outside Québec and outside Canada, information may be
        stored or processed there. Before relying on a provider outside Québec we assess the privacy
        risks and put contractual protections in place. We do not sell your information, and we do not
        use it for advertising.
      </p>

      <h2>Your choices and rights</h2>
      <ul>
        <li>
          <strong>Withdraw consent</strong> any time in <strong>Settings → Privacy choices</strong>.
          Analytics stop immediately and the app discards its analytics ID.
        </li>
        <li>
          <strong>Delete your data</strong> in <strong>Settings → Delete all my data</strong>. This
          removes your spins, temporary files, privacy record and analytics ID from your device.
        </li>
        <li>
          <strong>Ask us</strong> for access to, correction of, or deletion of any personal information
          we hold about you, or for a copy of it in a common format, by emailing{" "}
          <a href={`mailto:${EMAIL}`}>{EMAIL}</a>. We reply within 30 days. Because analytics are
          anonymous, we may need your app’s random ID (shown on request) to find your data.
        </li>
        <li>
          <strong>Manage or cancel your subscription</strong> in Google Play (Play Store → profile →
          Payments &amp; subscriptions). Uninstalling the app does not cancel it.
        </li>
      </ul>
      <p>
        If you are not satisfied with our answer you can complain to the{" "}
        <a href="https://www.cai.gouv.qc.ca/" rel="noopener">Commission d’accès à l’information du Québec</a>{" "}
        or the{" "}
        <a href="https://www.priv.gc.ca/" rel="noopener">Office of the Privacy Commissioner of Canada</a>.
      </p>

      <h2>How long we keep information</h2>
      <p>
        Files in the app stay on your phone until you delete them. Analytics events are kept only as
        long as needed to understand and improve the app. Purchase records are kept as long as the
        subscription relationship and tax and accounting rules require. When information is no longer
        needed we delete or anonymise it.
      </p>

      <h2>Security</h2>
      <p>
        Data sent to PostHog and RevenueCat travels over encrypted connections. The app disables
        Android’s automatic cloud backup so your spins are not copied to other places without you
        knowing. We keep a register of any confidentiality incident and will notify you and the
        regulator where the law requires it.
      </p>

      <h2>Children</h2>
      <p>
        The app is not directed at children under 14, and we do not knowingly collect their personal
        information.
      </p>

      <h2>Changes to this policy</h2>
      <p>
        If we change what we collect or why, we will update this page and ask for your consent again
        in the app before the change applies to you. The date above shows the latest version.
      </p>

      <h2>Contact</h2>
      <p>
        Privacy Officer, Plumbmonkey Media, Calgary, Alberta, Canada ·{" "}
        <a href={`mailto:${EMAIL}`}>{EMAIL}</a>
      </p>
    </LegalPage>
  );
}
