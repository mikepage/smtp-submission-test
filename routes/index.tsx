import { Head } from "fresh/runtime";
import { define } from "../utils.ts";
import SmtpTester from "../islands/SmtpTester.tsx";

export default define.page(function Home() {
  return (
    <div class="min-h-screen bg-[#fafafa]">
      <Head>
        <title>SMTP Submission Test</title>
      </Head>
      <div class="px-6 md:px-12 py-8">
        <div class="max-w-4xl mx-auto">
          <h1 class="text-2xl font-normal text-[#111] tracking-tight mb-2">
            SMTP Submission Test
          </h1>
          <p class="text-[#666] text-sm mb-8">
            Test SMTP server connectivity and TLS support. Enter your mail server hostname and port to verify submission capabilities.
          </p>
          <SmtpTester />
        </div>
      </div>
    </div>
  );
});
