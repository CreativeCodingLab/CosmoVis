# import the necessary packages
import asyncio
from pyppeteer import launch
import time
from skimage.measure import compare_ssim
import argparse
import imutils
import cv2

def analyzeDifferences(path1,path2):
    # https://www.pyimagesearch.com/2017/06/19/image-difference-with-opencv-and-python/
    # construct the argument parse and parse the arguments
    # ap = argparse.ArgumentParser()
    # ap.add_argument("-f", "--first", required=True,
    #     help="first input image")
    # ap.add_argument("-s", "--second", required=True,
    #     help="second")
    # args = vars(ap.parse_args())

    # load the two input images
    imageA = cv2.imread(path1)
    imageB = cv2.imread(path2)
    # convert the images to grayscale
    grayA = cv2.cvtColor(imageA, cv2.COLOR_BGR2GRAY)
    grayB = cv2.cvtColor(imageB, cv2.COLOR_BGR2GRAY)

    # compute the Structural Similarity Index (SSIM) between the two
    # images, ensuring that the difference image is returned
    (score, diff) = compare_ssim(grayA, grayB, full=True)
    diff = (diff * 255).astype("uint8")
    print("SSIM: {}".format(score))
    # threshold the difference image, followed by finding contours to
    # obtain the regions of the two input images that differ
    thresh = cv2.threshold(diff, 0, 255,
        cv2.THRESH_BINARY_INV | cv2.THRESH_OTSU)[1]
    cnts = cv2.findContours(thresh.copy(), cv2.RETR_EXTERNAL,
        cv2.CHAIN_APPROX_SIMPLE)
    cnts = imutils.grab_contours(cnts)

    # loop over the contours
    for c in cnts:
        # compute the bounding box of the contour and then draw the
        # bounding box on both input images to represent where the two
        # images differ
        (x, y, w, h) = cv2.boundingRect(c)
        cv2.rectangle(imageA, (x, y), (x + w, y + h), (0, 0, 255), 2)
        cv2.rectangle(imageB, (x, y), (x + w, y + h), (0, 0, 255), 2)
    # show the output images
    # cv2.imshow("Original", imageA)
    # cv2.imshow("Modified", imageB)
    cv2.imshow("Diff", diff)
    cv2.imwrite("translate_" + path1 + "+" + path2 + ".png", diff)
    # cv2.imshow("Thresh", thresh)
    cv2.waitKey(0)
    return score

async def hoverAndClick(page,mouse,divID,delay):
    button = await page.querySelector(divID)
    pos = await button.boundingBox()
    await button.hover()
    time.sleep(delay)
    await mouse.click(int(pos['x']+pos['width']/2),int(pos['y'] + pos['height']/2))
    # time.sleep(delay)

async def main():
    scores = []
    browser = await launch(executablePath="C:\\Program Files (x86)\\BraveSoftware\\Brave-Browser\\Application\\brave.exe",headless=False,args=['--no-sandbox'],ignoreDefaultArgs=True,autoClose=False)
    page = await browser.newPage()
    await page.setViewport({'width': 1200, 'height': 800, 'deviceScaleFactor': 1})

    await page.goto('ddd:5000',timeout=100000,options={'waitUntil':'networkidle2'})
    
    
    innerWidth = await page.evaluate('window.innerWidth')
    innerHeight = await page.evaluate('window.innerHeight')

    mouse = page.mouse
    keyboard = page.keyboard
    
    await hoverAndClick(page,mouse,'#terminal_icon',1)
    # await hoverAndClick(page,mouse,'#size_select',1)
    # await keyboard.press('2')
    # await hoverAndClick(page,mouse,'#size_select',1)
    await hoverAndClick(page,mouse,'#data_layers_icon',1)

    await page.screenshot({'path': '1.png'})

    # rotate
    await mouse.move(innerWidth/2, innerHeight/2)
    await mouse.down()
    await mouse.move(innerWidth/2+250, innerHeight/2+50, {'steps': 100})
    await mouse.up()

    # zoom
    await page.screenshot({'path': '2.png'})
    scores.append(analyzeDifferences('1.png','2.png'))

    await keyboard.down('KeyS')
    await mouse.move(innerWidth/2, innerHeight/2)
    await mouse.down()
    await mouse.move(innerWidth/2, innerHeight/2-1000, {'steps': 100})
    await mouse.up()
    await keyboard.up('KeyS')

    await page.screenshot({'path': '3.png'})
    analyzeDifferences('2.png','3.png')

    await hoverAndClick(page,mouse,'#gas-eye-open',0.5)
    await hoverAndClick(page,mouse,'#gas-eye-closed',0.5)

    await page.screenshot({'path': '4.png'})
    analyzeDifferences('3.png','4.png')

    await hoverAndClick(page,mouse,'#dm-eye-open',0.5)
    await hoverAndClick(page,mouse,'#dm-eye-closed',0.5)

    await page.screenshot({'path': '5.png'})
    analyzeDifferences('4.png','5.png')

    await hoverAndClick(page,mouse,'#star-eye-open',0.5)
    await hoverAndClick(page,mouse,'#star-eye-closed',0.5)

    await page.screenshot({'path': '6.png'})
    analyzeDifferences('5.png','6.png')

    await hoverAndClick(page,mouse,'#gas-info',0.5)
    
    await page.screenshot({'path': '7.png'})
    analyzeDifferences('6.png','7.png')

    await hoverAndClick(page,mouse,'#gas_select',1)
    await keyboard.press('KeyH')
    await keyboard.press('KeyY')
    await hoverAndClick(page,mouse,'#gas_select',1)

    # time.sleep(15)

    # await hoverAndClick(page,mouse,'#data_layers_icon',15)

    await page.screenshot({'path': '8.png'})
    analyzeDifferences('7.png','8.png')

    await hoverAndClick(page,mouse,'#gasMinA',0.5)
    await mouse.down()
    await mouse.move(innerWidth/2-10, innerHeight/2, {'steps': 100})
    await mouse.up()
    
    
    
    # await hoverAndClick(page,mouse,'#galaxy_list',1)


    await hoverAndClick(page,mouse,'#ray',1)
    await hoverAndClick(page,mouse,'#skewer-laser',1)

    await page.screenshot({'path': '9.png'})
    analyzeDifferences('8.png','9.png')

    await mouse.click(innerWidth/2, innerHeight/2)
    await hoverAndClick(page,mouse,'#skewer-laser',1)

    await page.screenshot({'path': '10.png'})
    analyzeDifferences('9.png','10.png')

    # rotate
    await mouse.move(innerWidth/2, innerHeight/2)
    await mouse.down()
    await mouse.move(innerWidth/2+200, innerHeight/2, {'steps': 100})
    await mouse.up()

    # zoom
    await keyboard.down('KeyS')
    await mouse.move(innerWidth/2, innerHeight/2)
    await mouse.down()
    await mouse.move(innerWidth/2, innerHeight/2+1500, {'steps': 100})
    await mouse.up()
    await keyboard.up('KeyS')

    await page.screenshot({'path': '11.png'})
    analyzeDifferences('10.png','11.png')
    # await hoverAndClick(page,mouse,'#request-button-0',1)
    # await hoverAndClick(page,mouse,'#graph',1)
    # time.sleep(30)
    # await browser.close()

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

