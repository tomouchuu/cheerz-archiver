async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve, reject) => {
      let totalHeight = 0;
      let distance = 100;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;

        if(totalHeight >= scrollHeight){
          clearInterval(timer);
          resolve();
        }
      }, 2000);
    });
  });
};

module.exports = autoScroll;
