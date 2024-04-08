import { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import cheerio from "cheerio";
//  Todo --> find emails that contains 'at' or 'dot' in it edistrict-grievance[at]supportgov[dot]in
async function findEmailAddresses(url: string): Promise<string[]> {
  try {
    const response = await fetch(url);
    const html = await response.text();
    const $ = cheerio.load(html);
    const emailAddresses = new Set<string>();

    $("body")
      .text()
      .split(/\s+/)
      .forEach((word) => {
        if (word.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/)) {
          emailAddresses.add(word);
        }
        // with [at][dot]
        // if (
        //   word.match(
        //     /\b[A-Za-z0-9._%+-]+(?:\[at\]|@)[A-Za-z0-9.-]+(?:\[dot\]|.[A-Za-z]{2,})\b/
        //   )
        // ) {
        //   emailAddresses.add(word);
        // }
      });
    const filteredEmailAddresses = Array.from(emailAddresses).filter(
      (email) => {
        const forbiddenExtensions = [
          ".png",
          ".jpeg",
          ".jpg",
          ".pdf",
          ".webp",
          ".gif",
          "github.com",
          "fb.com",
          "email.com",
          "Email.com",
          "company.com",
          "acme.com",
          "mysite.com",
          "domain.com",
          ".wixpress.com",
          "gmail.com",
          "example.com",
          ".mov",
          ".webm",
          "sentry.io",
          "@x.com",
          "@twitter.com",
          "@producthunt.com",
        ];
        return !forbiddenExtensions.some((extension) =>
          email.endsWith(extension)
        );
      }
    );
    return filteredEmailAddresses;
  } catch (error) {
    console.error(`Error while processing ${url}: ${error}`);
    return [];
  }
}

async function crawlWebsite(startUrl: string) {
  const visited = new Set<string>();
  const queue: string[] = [startUrl];
  while (queue.length > 0) {
    const currentUrl = queue.shift();
    if (!currentUrl || visited.has(currentUrl)) {
      continue;
    }
    visited.add(currentUrl);
    try {
      const emailAddresses = await findEmailAddresses(currentUrl);

      if (emailAddresses.length > 0) {
        const websiteData = {
          mainPageUrl: startUrl,
          foundEmailsUrls: [{ url: currentUrl, emails: emailAddresses }],
        };
        return websiteData;
      }
      const response = await fetch(currentUrl);
      const html = await response.text();
      const $ = cheerio.load(html);
      const links = $("a[href]");
      links.each((index, element) => {
        const absoluteUrl = new URL($(element).attr("href")!, currentUrl).href;
        queue.push(absoluteUrl);
      });
    } catch (error) {
      console.error(`Error while processing ${currentUrl}: ${error}`);
    }
  }
  return {
    mainPageUrl: startUrl,
    foundEmailsUrls: [],
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const { startingUrls } = req.body;

  if (!startingUrls || !Array.isArray(startingUrls)) {
    return res.status(400).json({ message: "Starting URLs are required" });
  }

  const allWebsitesData: any[] = [];
  for (const startUrl of startingUrls) {
    const remainingWebsites = startingUrls.length - allWebsitesData.length;
    console.log(
      `\nSearching for email on ${startUrl} and its linked pages. ${remainingWebsites} websites remaining:`
    );
    const websiteData = await crawlWebsite(startUrl as string);
    allWebsitesData.push(websiteData);
  }

  res.status(200).json({ websites: allWebsitesData });
}
