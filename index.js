const express = require('express');
const app = express();

app.listen(process.env.WEB_PORT||8080,() => {
    console.info(`[Server] Listening on ${process.env.WEB_PORT||8080}`)
})

const got = require('got');
const fs = require('fs').promises;
const cheerio = require('cheerio');
const QUERY_SEARCH = [
    "TNT"
]

app.get('/mcwiki/:query',async(req,res) => {
    getMCWiki(req.params.query,{force:req.query.force==true})
    .then(result => {
        res.json(result);
    }).catch(err => {
        
        res.status(500).json({
            error:err.message
        })
    })
})
app.get('*',(req,res) => res.status(404).json({error:"Page Not Found"}))



async function getMCWiki (query,opts = {}) {
    return new Promise(async(resolve,reject) => {
        if(opts.force) {
            try {
                const json = await runScrape(`https://minecraft.gamepedia.com/` + query)
                await fs.writeFile(`cache/mcwiki/${query}.json`,JSON.stringify(json,null,2),'utf-8');
                return resolve(json)
            }catch(err) {
                reject(err);
            }
            return;
        }
        fs.readFile(`cache/mcwiki/${query}.json`,'utf-8')
        .then(async(cache_result) => {
            const result = JSON.parse(cache_result);
            if((Date.now() - result.timestamp) >= 604800000) {
                try {
                    const json = await runScrape(`https://minecraft.gamepedia.com/` + query)
                    await fs.writeFile(`cache/mcwiki/${query}.json`,JSON.stringify(json,null,2),'utf-8');
                    return resolve(json)
                }catch(err) {
                    reject(err);
                }
            }else{
                resolve(result)
            }
        }).catch(async(err) => {
            try {
                const json = await runScrape(`https://minecraft.gamepedia.com/` + query)
                await fs.writeFile(`cache/mcwiki/${query}.json`,JSON.stringify(json,null,2),'utf-8');
                return resolve(json)
            }catch(err) {
                reject(err);
            }
        })
    })
}

//todo: process each section separatetly
async function runScrape(url) {
    return new Promise(async(resolve,reject) => {
        got(url,{method:"GET"})
        .then(async(response) => {
            const $ = cheerio.load(response.body);
            let content = {}; 

            const title = $("title").text();
            const subject = $('#firstHeading').text();
            // Do some data extraction from the page with Cheerio.
            const body_selector = $('#content #mw-content-text .mw-parser-output');
            const subtitle = body_selector.children('p').first().text().replace(/\n/g,'')

            body_selector.find('.mw-headline').each(function(index,element) {
                const headline_body = $(this).parent().nextUntil('h2','p').text() //.nextUntil("h2").text();
                content[element.children[0].data] = (headline_body === "") ? null : headline_body;
            })

            resolve({
                url,
                title,
                subject,
                subtitle,
                content,
                timestamp:Date.now()
            })
        }).catch(err => {
            reject(err);
        })
    })
}
