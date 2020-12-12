import asyncio
from pyppeteer import launch, mouse
import time

async def main():
    browser = await launch(ignoreDefaultArgs=True)
    page = await browser.newPage()
    await page.goto('localhost:5000',timeout=100000)
    time.sleep(4)
    await page.screenshot({'path': 'example.png'})
    await browser.close()

asyncio.get_event_loop().run_until_complete(main())

# Can it identify a fake bug?
    # Divergence from ideal case
    # put in known bugs because they are quantifiable
    # button moves outside of the dialogue box
        # logic check --> make sure that the bounding box is within the screen space
        # instructions --> different languages could make text longer
    # common actions
        # size change (font zoom size)


# OPTION 1: Hard Code ideal interactions
    # hover and click over "data" menu option
        # use ElementHandle class to find element based on ID
        # get the boundingBox(): x,y,width,height
        # use Mouse class to move() cursor to center of bounding box, and click()
    # change dataset, wait
    # change resolution, wait
    # scrub slicers

    # layers panel
    # hone in on particle type
    # turn on / off visibility
    # adjust thresholds
    # change attribute
    # change color

    # move universe around
    # open skewer draw skewer panel
    # place skewer

# OPTION 2: Use Tracing Class to create a trace file

