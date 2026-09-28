import test from "node:test";
import assert from "node:assert/strict";
import { validateJobOpportunity } from "@/lib/job-quality";

test("job quality accepts a local Pracuj detail offer", () => {
  const result = validateJobOpportunity({
    source: "pracuj.pl",
    url: "https://www.pracuj.pl/praca/business-development-manager-k-m-ruda-slaska-pionierow-39,oferta,1004621107",
    title: "Oferta pracy Business Development Manager (K/M), i2 Analytical",
    company: "i2 Analytical",
    location: "Ruda Śląska",
    description: "Praca Business Development Manager w Ruda Śląska."
  });
  assert.equal(result.valid, true);
});

test("job quality rejects a Pracuj search/listing page", () => {
  const result = validateJobOpportunity({
    source: "pracuj.pl",
    url: "https://www.pracuj.pl/praca/customer%20service%20manager;kw/katowice;wp",
    title: "Praca customer service manager, Katowice",
    location: "Ruda Śląska",
    description: "Wyniki ofert pracy."
  });
  assert.equal(result.valid, false);
  assert.equal(result.reason, "PROVIDER_NOT_DETAIL");
});

test("job quality rejects an out-of-scope detail offer", () => {
  const result = validateJobOpportunity({
    source: "linkedin",
    url: "https://pl.linkedin.com/jobs/view/export-manager-at-example-4359520735",
    title: "Export Manager",
    company: "Example",
    location: "Warszawa",
    description: "Export Manager."
  });
  assert.equal(result.valid, false);
  assert.equal(result.reason, "OUT_OF_GEO_SCOPE");
});

test("job quality rejects unknown providers even when the role matches", () => {
  const result = validateJobOpportunity({
    source: "web",
    url: "https://example.com/job/export-manager-gliwice",
    title: "Export Manager",
    location: "Gliwice",
    description: "Export Manager in Gliwice."
  });
  assert.equal(result.valid, false);
  assert.equal(result.reason, "SOURCE_NOT_ALLOWED");
});

test("job quality rejects LinkedIn search URLs", () => {
  const result = validateJobOpportunity({
    source: "linkedin",
    url: "https://www.linkedin.com/jobs/search/?keywords=manager&location=Gliwice",
    title: "Manager jobs in Gliwice",
    location: "Gliwice",
    description: "Search results."
  });
  assert.equal(result.valid, false);
});
