import json, re, sys, time
from playwright.sync_api import sync_playwright, expect
BASE = sys.argv[1]; OUT = sys.argv[2]
tasks = {t["id"]: t for t in json.load(open(sys.argv[3]))["tasks"]}
with sync_playwright() as p:
    b = p.chromium.launch()
    page = b.new_page(viewport={"width": 1360, "height": 1000})
    errors = []
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.goto(BASE + "/runs")
    page.get_by_label("Klucz API").fill("eval-local-key")
    page.get_by_role("button", name="Zaloguj").click()
    expect(page.get_by_role("heading", name="Agent runs")).to_be_visible()
    # 1) coding run with sandbox
    page.get_by_label("Cel").fill(tasks["T12"]["task"])
    page.get_by_label("Kryteria akceptacji (jedno na linię)").fill("\n".join(tasks["T12"]["criteria"]))
    page.get_by_role("button", name="Uruchom").click()
    expect(page.locator("section [data-status='COMPLETED']").first).to_be_visible(timeout=60000)
    page.locator("button", has_text=re.compile(r"^invoice\.py")).click()
    expect(page.locator("pre").filter(has_text="def calculate_invoice")).to_be_visible()
    page.screenshot(path=OUT + "/runs-completed.png", full_page=True)
    # 2) approval flow
    page.get_by_label("Cel").fill(tasks["T11"]["task"])
    page.get_by_label("Kryteria akceptacji (jedno na linię)").fill("")
    page.get_by_role("button", name="Uruchom").click()
    expect(page.get_by_text("Wymaga akceptacji: send_email")).to_be_visible(timeout=60000)
    page.screenshot(path=OUT + "/runs-approval.png", full_page=True)
    page.get_by_role("button", name="Odrzuć").click()
    expect(page.locator("section [data-status='COMPLETED']").first).to_be_visible(timeout=60000)
    expect(page.get_by_text("Rejected by human")).to_be_visible()
    # 3) mobile layout
    page.set_viewport_size({"width": 390, "height": 900})
    page.screenshot(path=OUT + "/runs-mobile.png", full_page=False)
    print("E2E_OK console_errors=", errors)
    b.close()
