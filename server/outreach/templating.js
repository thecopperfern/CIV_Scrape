const sanitizeHtml = require("sanitize-html");

const TAG_RE = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;

function getPath(obj, path) {
  if (!obj) return undefined;
  const parts = String(path).split(".");
  let cur = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

function buildScope(target) {
  if (!target) return {};
  let custom = {};
  try {
    custom = JSON.parse(target.custom_fields_json || target.customFieldsJson || "{}") || {};
  } catch {
    custom = {};
  }
  const display = target.display_name || target.displayName || "";
  const firstName = display.split(/\s+/)[0] || "";
  return {
    email: target.email || "",
    phone: target.phone || "",
    company: target.company || "",
    name: display,
    display_name: display,
    first_name: firstName,
    ...custom
  };
}

function substitute(text, target) {
  if (!text) return "";
  const scope = buildScope(target);
  return String(text).replace(TAG_RE, (match, key) => {
    const v = getPath(scope, key);
    return v == null ? "" : String(v);
  });
}

const HTML_ALLOWED_TAGS = [
  "a", "abbr", "b", "blockquote", "br", "code", "em", "h1", "h2", "h3", "h4", "h5", "h6",
  "hr", "i", "img", "li", "ol", "p", "pre", "small", "span", "strong", "sub", "sup", "table",
  "tbody", "td", "tfoot", "th", "thead", "tr", "u", "ul", "div"
];

function sanitize(html) {
  return sanitizeHtml(html || "", {
    allowedTags: HTML_ALLOWED_TAGS,
    allowedAttributes: {
      a: ["href", "name", "target", "rel", "title"],
      img: ["src", "alt", "title", "width", "height"],
      "*": ["style"]
    },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer", target: "_blank" }, true)
    }
  });
}

function htmlToText(html) {
  if (!html) return "";
  return String(html)
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function renderEmail(template, target) {
  const subject = substitute(template.subject || "", target);
  const rawBody = substitute(template.body || "", target);
  const html = sanitize(rawBody);
  const text = htmlToText(html);
  return { subject, html, text };
}

function renderSms(template, target) {
  const body = substitute(template.body || "", target);
  // Strip any HTML tags that might have slipped in
  return { body: body.replace(/<[^>]+>/g, "").trim() };
}

function render(template, target) {
  if (template.channel === "sms") return renderSms(template, target);
  return renderEmail(template, target);
}

module.exports = { render, renderEmail, renderSms, substitute, sanitize, htmlToText };
