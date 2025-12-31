import { Head } from "fresh/runtime";
import { define } from "../utils.ts";
import SmtpTester from "../islands/SmtpTester.tsx";

export default define.page(function Home() {
  return (
    <div class="min-h-screen bg-gray-100">
      <Head>
        <title>SMTP Submission Test</title>
      </Head>
      <div class="max-w-4xl mx-auto px-4 py-8">
        <div class="mb-6">
          <h1 class="text-3xl font-bold text-gray-800">SMTP Submission Test</h1>
          <p class="text-gray-600 mt-2">
            Test SMTP server connectivity and TLS support. Enter your mail server
            hostname and port to verify submission capabilities.
          </p>
        </div>
        <SmtpTester />
      </div>
    </div>
  );
});
