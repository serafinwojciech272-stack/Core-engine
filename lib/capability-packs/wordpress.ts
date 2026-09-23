import { registerCapabilityPack } from "@/lib/capability-registry";
import type { CapabilityPack } from "@/lib/capability-contracts";

const packs: CapabilityPack[] = [
  {
    id: "seo-suite", name: "SEO Intelligence", version: "1.0.0", category: "SEO",
    inspiredBy: ["Yoast SEO", "Rank Math SEO", "All in One SEO"],
    description: "Technical SEO, content optimization, schema, sitemaps and search visibility diagnostics.",
    capabilities: ["on-page scoring","keyword intent","schema generation","XML sitemap","robots directives","canonical validation","internal linking","AI content optimization"],
    actions: [
      { id:"seo.audit", name:"Run SEO audit", description:"Audit technical and on-page SEO.", risk:"LOW", requiresApproval:false, inputs:["url"], outputs:["seo_findings","seo_score"] },
      { id:"seo.optimize", name:"Prepare SEO optimization", description:"Generate an evidence-backed optimization plan.", risk:"MEDIUM", requiresApproval:true, inputs:["page","target_intent"], outputs:["optimization_plan"] }
    ],
    signals:["organic_traffic","indexation","click_through_rate","core_web_vitals","keyword_visibility"], diagnostics:["missing_metadata","duplicate_content","schema_gap","crawlability","internal_link_gap"], metrics:["seo_score","indexed_pages","organic_clicks","ctr"]
  },
  {
    id:"visual-builder", name:"Visual Website Builder", version:"1.0.0", category:"PAGES",
    inspiredBy:["Elementor","Divi","WPBakery"],
    description:"Component-based page generation with reusable sections, responsive rules and design tokens.",
    capabilities:["landing pages","section library","responsive layouts","global styles","design tokens","component reuse","conversion sections","accessibility checks"],
    actions:[
      {id:"page.generate",name:"Generate page",description:"Create a structured page plan from business context.",risk:"MEDIUM",requiresApproval:true,inputs:["objective","audience","offer"],outputs:["page_spec"]},
      {id:"page.optimize",name:"Optimize page",description:"Propose UX and conversion improvements.",risk:"MEDIUM",requiresApproval:true,inputs:["page_url","analytics"],outputs:["optimization_mission"]}
    ],
    signals:["bounce_rate","engagement_time","conversion_rate","mobile_score"], diagnostics:["weak_hero","cta_friction","trust_gap","layout_overload"], metrics:["conversion_rate","engagement","page_speed"]
  },
  {
    id:"commerce-suite", name:"Commerce Intelligence", version:"1.0.0", category:"ECOMMERCE",
    inspiredBy:["WooCommerce"],
    description:"Products, catalog, checkout, orders, subscriptions, payments and commerce growth intelligence.",
    capabilities:["catalog intelligence","checkout diagnostics","cart recovery","pricing analysis","order analytics","subscription metrics","payment health"],
    actions:[{id:"commerce.optimize-checkout",name:"Optimize checkout",description:"Diagnose and prepare checkout improvements.",risk:"HIGH",requiresApproval:true,inputs:["checkout_metrics"],outputs:["checkout_mission"]}],
    signals:["orders","aov","cart_abandonment","checkout_conversion","refund_rate"], diagnostics:["checkout_dropoff","payment_failure","catalog_gap","pricing_gap"], metrics:["revenue","aov","conversion_rate","refund_rate"]
  },
  {
    id:"forms-leads", name:"Forms & Lead Capture", version:"1.0.0", category:"FORMS",
    inspiredBy:["Contact Form 7","WPForms","Gravity Forms"],
    description:"Lead forms, qualification, routing, spam controls and conversion measurement.",
    capabilities:["form generation","field optimization","lead qualification","routing","conversion tracking","abandonment analysis"],
    actions:[{id:"forms.optimize",name:"Optimize lead form",description:"Reduce friction and improve lead quality.",risk:"MEDIUM",requiresApproval:true,inputs:["form_metrics"],outputs:["form_plan"]}],
    signals:["form_views","form_starts","form_completions","lead_quality"], diagnostics:["too_many_fields","low_completion","poor_qualification"], metrics:["form_conversion","qualified_lead_rate"]
  },
  {
    id:"analytics-suite",name:"Analytics & Measurement",version:"1.0.0",category:"ANALYTICS",
    inspiredBy:["Site Kit by Google","Google Analytics","GTM4WP"],
    description:"Unified analytics, attribution, event tracking, Search Console and business KPI measurement.",
    capabilities:["event taxonomy","conversion tracking","attribution","funnel analysis","Search Console intelligence","KPI dashboards"],
    actions:[{id:"analytics.audit",name:"Audit measurement",description:"Detect tracking and attribution gaps.",risk:"LOW",requiresApproval:false,inputs:["site","tracking_config"],outputs:["measurement_findings"]}],
    signals:["sessions","events","conversions","revenue","search_clicks"], diagnostics:["tracking_gap","attribution_gap","funnel_gap"], metrics:["data_completeness","conversion_rate","attribution_coverage"]
  },
  {
    id:"security-suite",name:"Security & Firewall",version:"1.0.0",category:"SECURITY",
    inspiredBy:["Wordfence Security","Really Simple Security","Jetpack Security"],
    description:"Threat detection, authentication hardening, vulnerability posture and security policy.",
    capabilities:["security audit","2FA policy","vulnerability scan","login protection","permission review","security alerts"],
    actions:[{id:"security.harden",name:"Harden security",description:"Prepare least-privilege security changes.",risk:"CRITICAL",requiresApproval:true,inputs:["security_findings"],outputs:["security_mission"]}],
    signals:["failed_logins","vulnerabilities","admin_count","2fa_coverage"], diagnostics:["weak_auth","excess_privilege","outdated_component","attack_pattern"], metrics:["security_score","2fa_coverage","critical_findings"]
  },
  {
    id:"performance-suite",name:"Performance & Core Web Vitals",version:"1.0.0",category:"PERFORMANCE",
    inspiredBy:["WP Rocket","LiteSpeed Cache"],
    description:"Caching, asset optimization, image optimization and Core Web Vitals intelligence.",
    capabilities:["cache strategy","asset optimization","image optimization","lazy loading","CWV diagnostics","performance budgets"],
    actions:[{id:"performance.optimize",name:"Optimize performance",description:"Create a performance improvement mission.",risk:"MEDIUM",requiresApproval:true,inputs:["performance_metrics"],outputs:["performance_plan"]}],
    signals:["lcp","inp","cls","ttfb","page_weight"], diagnostics:["slow_lcp","high_ttfb","render_blocking","oversized_media"], metrics:["lcp","inp","cls","ttfb"]
  },
  {
    id:"backup-recovery",name:"Backup & Disaster Recovery",version:"1.0.0",category:"BACKUP",
    inspiredBy:["UpdraftPlus","Jetpack Backup","All-in-One WP Migration"],
    description:"Backup policy, restore readiness, retention and recovery verification.",
    capabilities:["backup scheduling","retention policy","restore testing","recovery point tracking","migration readiness"],
    actions:[{id:"backup.restore-test",name:"Verify restore readiness",description:"Test recovery procedure without destructive changes.",risk:"HIGH",requiresApproval:true,inputs:["backup_snapshot"],outputs:["restore_report"]}],
    signals:["last_backup","backup_age","restore_test_age","storage_health"], diagnostics:["stale_backup","restore_gap","retention_gap"], metrics:["backup_freshness","restore_success","rpo"]
  },
  {
    id:"redirect-manager",name:"Redirect & URL Intelligence",version:"1.0.0",category:"REDIRECTS",
    inspiredBy:["Redirection"],
    description:"Redirect mapping, broken-link detection and migration safety.",
    capabilities:["404 detection","redirect mapping","chain detection","canonical migration","redirect monitoring"],
    actions:[{id:"redirect.plan",name:"Prepare redirect plan",description:"Map broken or migrated URLs safely.",risk:"MEDIUM",requiresApproval:true,inputs:["crawl_data"],outputs:["redirect_plan"]}],
    signals:["404_rate","redirect_chain_count","broken_links"], diagnostics:["404_cluster","redirect_chain","migration_risk"], metrics:["404_rate","redirect_success"]
  },
  {
    id:"email-delivery",name:"Transactional Email",version:"1.0.0",category:"EMAIL",
    inspiredBy:["WP Mail SMTP"],
    description:"Email delivery diagnostics, sender reputation and transactional reliability.",
    capabilities:["SMTP diagnostics","delivery monitoring","domain authentication","bounce analysis","template validation"],
    actions:[{id:"email.audit",name:"Audit email delivery",description:"Diagnose transactional email reliability.",risk:"LOW",requiresApproval:false,inputs:["mail_config"],outputs:["mail_findings"]}],
    signals:["delivery_rate","bounce_rate","spf","dkim","dmarc"], diagnostics:["smtp_gap","authentication_gap","bounce_spike"], metrics:["delivery_rate","bounce_rate"]
  },
  {
    id:"spam-protection",name:"Anti-Spam & Abuse",version:"1.0.0",category:"ANTI_SPAM",
    inspiredBy:["Akismet Anti-Spam"],
    description:"Spam detection, abuse signals and adaptive form protection.",
    capabilities:["spam scoring","abuse detection","submission anomaly detection","adaptive protection"],
    actions:[{id:"spam.tune",name:"Tune abuse protection",description:"Adjust protection rules from observed abuse patterns.",risk:"MEDIUM",requiresApproval:true,inputs:["abuse_signals"],outputs:["protection_plan"]}],
    signals:["spam_rate","suspicious_submissions","blocked_requests"], diagnostics:["spam_spike","bot_pattern","false_positive_risk"], metrics:["spam_rate","false_positive_rate"]
  },
  {
    id:"custom-data",name:"Structured Content & Data",version:"1.0.0",category:"DATA",
    inspiredBy:["Advanced Custom Fields"],
    description:"Typed business entities, custom fields, content schemas and reusable data models.",
    capabilities:["custom entities","typed fields","relationships","content schemas","data validation","business object modeling"],
    actions:[{id:"data.model",name:"Design business data model",description:"Create a typed model for a business capability.",risk:"MEDIUM",requiresApproval:true,inputs:["requirements"],outputs:["data_model"]}],
    signals:["data_completeness","schema_errors","orphan_records"], diagnostics:["missing_field","invalid_relation","schema_drift"], metrics:["data_quality","schema_completeness"]
  },
  {
    id:"social-growth",name:"Social & Distribution",version:"1.0.0",category:"SOCIAL",
    inspiredBy:["Jetpack","Google for WooCommerce","Mailchimp"],
    description:"Content distribution, campaign planning and social performance intelligence.",
    capabilities:["content calendar","campaign planning","channel adaptation","engagement analysis","distribution missions"],
    actions:[{id:"social.plan",name:"Build distribution plan",description:"Create a channel-aware content distribution mission.",risk:"MEDIUM",requiresApproval:true,inputs:["content","channels"],outputs:["distribution_plan"]}],
    signals:["reach","engagement","clicks","assisted_conversions"], diagnostics:["channel_gap","content_gap","engagement_drop"], metrics:["engagement_rate","assisted_conversion"]
  },
  {
    id:"localization",name:"Localization & Internationalization",version:"1.0.0",category:"LOCALIZATION",
    inspiredBy:["Loco Translate","WordPress localization"],
    description:"Multilingual content, locale consistency and international SEO readiness.",
    capabilities:["translation workflow","locale audit","hreflang planning","translation memory","language QA"],
    actions:[{id:"i18n.audit",name:"Audit localization",description:"Detect missing or inconsistent localized content.",risk:"LOW",requiresApproval:false,inputs:["locales"],outputs:["localization_findings"]}],
    signals:["locale_coverage","translation_completion","hreflang_validity"], diagnostics:["missing_translation","locale_mismatch","hreflang_gap"], metrics:["locale_coverage","translation_quality"]
  },
  {
    id:"monitoring-observability",name:"Site Monitoring & Diagnostics",version:"1.0.0",category:"MONITORING",
    inspiredBy:["Query Monitor","Jetpack","WP Crontrol"],
    description:"Runtime health, scheduled-job visibility, errors and operational diagnostics.",
    capabilities:["uptime monitoring","error diagnostics","cron visibility","dependency health","performance traces"],
    actions:[{id:"monitor.audit",name:"Run operational audit",description:"Inspect runtime health and recurring failures.",risk:"LOW",requiresApproval:false,inputs:["runtime_metrics"],outputs:["health_report"]}],
    signals:["uptime","error_rate","job_failures","latency","dependency_status"], diagnostics:["runtime_error","job_failure","dependency_failure"], metrics:["uptime","error_rate","p95_latency"]
  }
];

export function registerWordPressCapabilityPacks() {
  for (const pack of packs) registerCapabilityPack(pack);
  return packs;
}

export { packs as wordpressCapabilityPacks };
