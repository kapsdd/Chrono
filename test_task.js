(async () => {
  const sbKey = Object.keys(localStorage).find(k => k.indexOf("sb-") === 0);
  const auth = JSON.parse(localStorage.getItem(sbKey));
  const URL = "https://kzvkecedzkkgfeehpzhh.supabase.co/rest/v1/tasks";
  const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt6dmtlY2VkemtrZ2ZlZWhwemhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MDY0NTEsImV4cCI6MjA5NzI4MjQ1MX0.RoT84_GbRWGKzga3FAoo0qmGop_NjCPAUajbTuekwOs";
  const r = await fetch(URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + auth.access_token,
      "apikey": ANON,
      "Prefer": "return=representation"
    },
    body: JSON.stringify({owner_id: auth.user.id, title: "manual test", project_id: null})
  });
  console.log("STATUS:", r.status);
  console.log("BODY:", await r.text());
})();
