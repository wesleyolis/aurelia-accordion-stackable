import {TaskQueue, inject, autoinject, BindingEngine, bindable, customElement} from "aurelia-framework";

function getScrollbarWidth() {
  const e = document.createElement('div');
  e.style.position = 'absolute';
  e.style.top = '-9999px';
  e.style.width = '100px';
  e.style.height = '100px';
  e.style.overflow = 'scroll';
  e.style.msOverflowStyle = 'scrollbar';

  document.body.appendChild(e);

  const scrollbarWidth = (e.offsetWidth - e.clientWidth);

  document.body.removeChild(e);
  return scrollbarWidth;
}

const SCROLLBAR_WIDTH = getScrollbarWidth();

@autoinject()
@customElement("stackable")
export class Stackable {

  constructor(private taskQueue : TaskQueue, private bindingEngine : BindingEngine)
  {
  }

  @bindable categories : {collection:any[]} [] = [];
  @bindable zIndex = 5;
  @bindable showAllCategoriesIntiallyCollapsed : boolean = false;

  collectionObservablesDisposables : any [] = [];
  categoriesOffsetTop: number [] = [];
  stackTopCategies : any [] = [];
  stackBottomCategies : any [] = [];
  stackRenderSizeCategories : any [] = [];

  element: HTMLElement;
  viewElement: HTMLElement;
  resizeTrigger: HTMLObjectElement;
  verticalThumbElement: HTMLElement;
  verticalScrollbarElement: HTMLElement;
  horizontalThumbElement: HTMLElement;
  horizontalScrollbarElement: HTMLElement;
  stackBottomArrow: HTMLElement;

  stackable: HTMLElement;
  stackTop: HTMLElement;
  stackBottom: HTMLElement;
  stackRenderSize: HTMLElement;
  stackRenderSizeID: HTMLElement;
  stackRenderSizeCounter : number = 0;

  categoryHeadingHeight : number = null;
  categoryPreviewHeight : number = null;

  viewElementPreviousScrollTop : number | null = null;

  dragging: boolean = false;
  active: boolean = false;
  uiInitalize: boolean = false;
  allCategoriesInitiallyCollapsed : boolean = true;

  private verticalScrollDragStart: number;
  private horizontalScrollDragStart: number;

  private scrollHandler = () => this.handleScroll();
  private resizeHandler = (e: Event) => this.handleResize(e);
  private mouseMoveHandler = (e: MouseEvent) => this.handleMouseMove(e);
  private mouseUpHandler = (e: MouseEvent) => this.handleMouseUp(e);

  attached() {

    this.allCategoriesInitiallyCollapsed = this.showAllCategoriesIntiallyCollapsed

    this.onResizeWindow(window => {
      window.addEventListener("resize", this.resizeHandler);
    });

    this.viewElement.addEventListener("scroll", this.scrollHandler);

    this.updateViewElementVisibility();
    this.update();

    this.updateDomHeaderAndPreviewSizes();

    this.uiInitalize = true;

    this.stackTop.addEventListener('mousewheel', (event)=>
    {
    	this.viewElement.scrollTop = this.viewElement.scrollTop - event.wheelDeltaY;

      this.updateStackable(null, event.wheelDeltaY > 0);
    });

    this.stackBottom.addEventListener('mousewheel', (event)=>
    {
    	this.viewElement.scrollTop = this.viewElement.scrollTop - event.wheelDeltaY;

      this.updateStackable(null, event.wheelDeltaY > 0);
    });

    this.viewElement.onwheel = (event) => this.updateStackableFromMouse(event);

    this.updateStackable(null);
  }

  detached() {
    this.uiInitalize = false;

    this.onResizeWindow(window => {
      window.removeEventListener("resize", this.resizeHandler);
    });

    this.viewElement.removeEventListener("scroll", this.scrollHandler);
  }

  public categoriesChanged(newValue: any [], oldValue: any []): void {

    this.collectionObservablesDisposables.forEach(c =>
    {
      c.dispose();
    });

    this.allCategoriesInitiallyCollapsed = this.showAllCategoriesIntiallyCollapsed;

    this.categories.forEach(c =>
    {
      this.collectionObservablesDisposables.push(
          this.bindingEngine.propertyObserver(c,"collection").subscribe(() => {

          this.viewElementPreviousScrollTop = this.viewElement.scrollTop;
          this.update();
          this.initDomRenderSizeElements();
          this.queInitPreviewSize();
      }));
    });

    this.initDomRenderSizeElements();

    if(this.uiInitalize)
    {
      this.viewElement.scrollTop = 0;

      this.queInitPreviewSize();

      this.updateViewElementVisibility();
      this.update();
    }
  }

  queInitPreviewSize()
  {
     this.stackRenderSizeCounter++;

      let task = () => {

          if(!this.uiInitalize)
            return;

          if(this.stackRenderSizeID.innerText.trim() === `${this.stackRenderSizeCounter}`)
          {
            this.update();
            this.updateDomHeaderAndPreviewSizes();

            if(this.viewElementPreviousScrollTop !== null)
            {
              this.viewElement.scrollTop = this.viewElementPreviousScrollTop;
              this.viewElementPreviousScrollTop = null;
            }

            this.updateStackable(null);
          }
          else{
              this.taskQueue.queueTask(task);
          }
        };

      this.taskQueue.queueTask(task);
  }

  initDomRenderSizeElements()
  {
    this.categoryPreviewHeight = null;
    this.categoryHeadingHeight = null;

    this.categoriesOffsetTop = [];

    let stackRenderSize = [];

    if(this.categories.length != 0)
    {
      // For for the rendering size with preview on the bottom.
      stackRenderSize.push(this.categories[0]);
      // The other for the normal size of elements.
      stackRenderSize.push(this.categories[0]);

      this.stackRenderSizeCategories = [...stackRenderSize];
    }
  }

  updateDomHeaderAndPreviewSizes()
  {
    if(this.categoryPreviewHeight === null || this.categoryHeadingHeight === null)
    {
      if(this.stackRenderSizeCategories.length !== 0)
      {
        this.categoryPreviewHeight = this.stackRenderSize.firstElementChild.getBoundingClientRect().height;
        this.categoryHeadingHeight = this.stackRenderSize.lastElementChild.getBoundingClientRect().height;

        this.categoryPreviewHeight = this.categoryPreviewHeight - this.categoryHeadingHeight;

        for(let i = 0; i < this.categories.length; i++)
        {
          if(this.categoriesOffsetTop[i] == undefined)
          {
            this.categoriesOffsetTop[i] = (<HTMLElement><any>this.viewElement.children[i]).offsetTop;
          }
        }
      }
    }
  }

  updateStackableFromMouse(event : MouseEvent)
  {
    let scrollTop = this.viewElement.scrollTop;

    if(event != null)
    {
      scrollTop -= (<any>event).wheelDeltaY;

      let scrollClamp = this.viewElement.scrollHeight - this.viewElement.offsetHeight;

      if(scrollTop > scrollClamp)
        scrollTop = scrollClamp;

      if(scrollTop < 0)
        scrollTop = 0;
    }

    this.updateStackable(scrollTop, (<any>event).wheelDeltaY > 0);
  }

  updateStackable(scrollTop : number | null, scrollDirectionUp : boolean = false)
  {
    if(event != null)
      this.updateDomHeaderAndPreviewSizes();

    if(this.categoryPreviewHeight === null || this.categoryHeadingHeight == null)
    {
      console.log("Failed to prerender Header and PreviewItem to obtain sizes.");
      return;
    }

    let stackTopCategies = [];
    let stackBottomCategies = [];

    if(this.allCategoriesInitiallyCollapsed)
    {
      for(let i = 0; i < this.categories.length; i++)
        stackTopCategies.push(this.categories[i]);

        this.stackTopCategies = stackTopCategies;
        this.stackBottomCategies = [];

        this.stackBottomArrow.style.visibility = 'hidden';
        this.verticalScrollbarElement.style.visibility = 'hidden';
        this.verticalThumbElement.style.visibility = 'hidden';

        return;
    }

    this.verticalScrollbarElement.style.visibility = 'initial';
    this.verticalThumbElement.style.visibility = 'initial';

    if(scrollTop === null)
        scrollTop = this.viewElement.scrollTop;

    let scrollTopWithStack = scrollTop;

    for(let i = 0; i < this.categories.length; i++)
    {
      let headerTop = this.categoriesOffsetTop[i]

      if(scrollDirectionUp)
      {
        headerTop += this.categoryHeadingHeight;
      }

      if(scrollTopWithStack > headerTop)
      {
        scrollTopWithStack += this.categoryHeadingHeight;
        stackTopCategies.push(this.categories[i]);
      }
      else
      {
        break;
      }
    }

    let scrollBottom = scrollTop + this.viewElement.offsetHeight;

    for(let i = this.categories.length - 1; i >= 0 ; i--)
    {
      let bottomItemHeight = this.categoryHeadingHeight;

      if(this.categories[i].collection.length != 0)
        bottomItemHeight += this.categoryPreviewHeight;

      if((scrollBottom - bottomItemHeight) < this.categoriesOffsetTop[i])
      {
        scrollBottom -= this.categoryHeadingHeight;
        stackBottomCategies.push(this.categories[i]);
      }
      else
      {
        break;
      }
    }

    this.stackTopCategies = stackTopCategies;
    this.stackBottomCategies = stackBottomCategies;

    if(stackBottomCategies.length != 0)
      this.stackBottomArrow.style.visibility = 'visible';
    else
      this.stackBottomArrow.style.visibility = 'hidden';

  }


  showCategoryTop(i)
  {
    if(this.allCategoriesInitiallyCollapsed)
    {
      this.allCategoriesInitiallyCollapsed = false;
      this.updateViewElementVisibility();
      this.viewElement.scrollTop = this.categoriesOffsetTop[0] - ((0 + 1) * this.categoryHeadingHeight);

      this.updateStackable(null);
      return;
    }
    /*
      Disabled until such time we decide to enable it again.
    this.viewElement.scrollTop = this.categoriesOffsetTop[i] - (i * this.categoryHeadingHeight);

    this.updateStackable(null);
    */
  }

  showCategoryMiddle(i)
  {
      this.viewElement.scrollTop = this.categoriesOffsetTop[i] - (this.stackTopCategies.length * this.categoryHeadingHeight);

      this.updateStackable(null);
  }

  showCategoryBottom(i)
  {
    let position = this.categories.length - (this.stackBottomCategies.length - i);
    this.viewElement.scrollTop = this.categoriesOffsetTop[position] - (this.categories.length - (this.stackBottomCategies.length - i) + 1) * this.categoryHeadingHeight;

    this.updateStackable(null);
  }

  updateViewElementVisibility()
  {
    if(this.allCategoriesInitiallyCollapsed)
    {
      this.viewElement.style.visibility = 'hidden';
      this.stackTop.style.cursor = 'pointer';
    }
    else
    {
      this.viewElement.style.visibility = 'initial';
      this.stackTop.style.cursor = 'initial';
    }
  }

  update() {

    this.stackTop.style.zIndex = `${this.zIndex}`;
    this.stackBottom.style.zIndex = `${this.zIndex}`;
    this.verticalThumbElement.style.zIndex = `${this.zIndex + 1}`;
    this.verticalScrollbarElement.style.zIndex = `${this.zIndex + 1}`;
    this.horizontalThumbElement.style.zIndex = `${this.zIndex + 1}`;
    this.horizontalScrollbarElement.style.zIndex = `${this.zIndex + 1}`;
    this.viewElement.style.width = '';
    this.viewElement.style.height = '';

    let height = this.element.parentElement.offsetHeight - this.stackable.offsetTop;

    this.stackable.style.height = `${height}px`;
    this.stackable.style.width = `${this.element.offsetWidth}px`;

    this.viewElement.style.width = `${this.element.offsetWidth + SCROLLBAR_WIDTH}px`;
    this.viewElement.style.height = `${height + SCROLLBAR_WIDTH}px`;

    const heightPercentage = this.viewElement.clientHeight * 100 / this.viewElement.scrollHeight;
    const widthPercentage = this.viewElement.clientWidth * 100 / this.viewElement.scrollWidth;

    this.verticalThumbElement.style.height = heightPercentage < 100 ? `${heightPercentage}%` : "";
    heightPercentage < 100 ? this.verticalScrollbarElement.classList.add("scrollbar-required") : this.verticalScrollbarElement.classList.remove("scrollbar-required");
    this.horizontalThumbElement.style.width = widthPercentage < 100 ? `${widthPercentage}%` : "";
    widthPercentage < 100 ? this.horizontalScrollbarElement.classList.add("scrollbar-required") : this.horizontalScrollbarElement.classList.remove("scrollbar-required");

    if(widthPercentage < 100)
      this.stackBottom.style.bottom = `${SCROLLBAR_WIDTH}px`;

    this.stackBottom.style.paddingRight = this.stackTop.style.paddingRight = `${this.verticalScrollbarElement.offsetWidth + SCROLLBAR_WIDTH}px`;

    this.handleScroll();
  }

  private onResizeWindow(run: (window: Window) => void) {
    const resizeWindow = this.resizeTrigger.contentDocument && this.resizeTrigger.contentDocument.defaultView;
    if (resizeWindow) return run(resizeWindow);
    this.resizeTrigger.onload = () => {
      const resizeWindow = this.resizeTrigger.contentDocument && this.resizeTrigger.contentDocument.defaultView;
      if (resizeWindow) return run(resizeWindow);
      this.resizeTrigger.onload = null;
    };
  }

  private handleScroll() {

    const x = (this.viewElement.scrollLeft * 100) / this.viewElement.clientWidth;
    const y = (this.viewElement.scrollTop * 100) / this.viewElement.clientHeight;

    this.horizontalThumbElement.style.webkitTransform = `translateY(${x}%)`;
    this.verticalThumbElement.style.webkitTransform = `translateY(${y}%)`;

    (<CSSStyleDeclaration & { msTransform: string; }>this.horizontalThumbElement.style).msTransform = `translateY(${x}%)`;
    (<CSSStyleDeclaration & { msTransform: string; }>this.verticalThumbElement.style).msTransform = `translateY(${y}%)`;

    this.horizontalThumbElement.style.transform = `translateY(${x}%)`;
    this.verticalThumbElement.style.transform = `translateY(${y}%)`;
  }

  private handleResize(e: Event) {
    this.update();
    this.initDomRenderSizeElements();
  }

  private handleMouseUp(e: MouseEvent) {
    this.stopDragging();
    this.verticalScrollDragStart = undefined;
    this.horizontalScrollDragStart = undefined;
  }

  private handleMouseMove(e: MouseEvent) {
    if (this.verticalScrollDragStart !== undefined) {
      const offset = e.clientY - this.verticalScrollbarElement.getBoundingClientRect().top;
      const thumbPositionDelta = this.verticalThumbElement.offsetHeight - this.verticalScrollDragStart;
      const thumbPositionPercentage = 100 * (offset - thumbPositionDelta) / this.verticalScrollbarElement.offsetHeight;
      let scrollTop = (thumbPositionPercentage * this.viewElement.scrollHeight) / 100;

      let scrollUp = this.viewElement.scrollTop > scrollTop;

      this.viewElement.scrollTop = scrollTop;

      this.updateStackable(this.viewElement.scrollTop, scrollUp);
    }

    if (this.horizontalScrollDragStart !== undefined) {
      const offset = e.clientX - this.horizontalScrollbarElement.getBoundingClientRect().left;
      const thumbPositionDelta = this.horizontalThumbElement.offsetWidth - this.horizontalScrollDragStart;
      const thumbPositionPercentage = 100 * (offset - thumbPositionDelta) / this.horizontalScrollbarElement.offsetWidth;
      this.viewElement.scrollLeft = (thumbPositionPercentage * this.viewElement.scrollWidth) / 100;
    }
  }

  private handleClickVerticalTrack(e: MouseEvent) {
    const offset = Math.abs((<HTMLElement>e.target).getBoundingClientRect().top - e.clientY);
    const thumbHalf = this.verticalThumbElement.offsetHeight / 2;
    const thumbPositionPercentage = 100 * (offset - thumbHalf) / this.verticalScrollbarElement.offsetHeight;

    this.viewElement.scrollTop = (thumbPositionPercentage * this.viewElement.scrollHeight) / 100;
  }

  private handleClickHorizontalTrack(e: MouseEvent) {
    const offset = Math.abs((<HTMLElement>e.target).getBoundingClientRect().left - e.clientX);
    const thumbHalf = this.horizontalThumbElement.offsetWidth / 2;
    const thumbPositionPercentage = 100 * (offset - thumbHalf) / this.horizontalScrollbarElement.offsetWidth;

    this.viewElement.scrollLeft = (thumbPositionPercentage * this.viewElement.scrollWidth) / 100;
  }

  private handleMouseDownVerticalThumb(e: MouseEvent) {
    this.verticalScrollDragStart = (<HTMLElement>e.currentTarget).offsetHeight - e.clientY + (<HTMLElement>e.currentTarget).getBoundingClientRect().top;
    this.startDragging(e);
  }

  private handleMouseDownHorizontalThumb(e: MouseEvent) {
    this.horizontalScrollDragStart = (<HTMLElement>e.currentTarget).offsetWidth - e.clientX + (<HTMLElement>e.currentTarget).getBoundingClientRect().left;
    this.startDragging(e);
  }

  private handleMouseOver(event: MouseEvent) {
    this.active = true;
  }

  private handleMouseOut(event: MouseEvent) {
    this.active = false;
  }

  private startDragging(e: MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    this.dragging = true;
    document.onselectstart = function() { return false; };
    document.addEventListener("mousemove", this.mouseMoveHandler);
    document.addEventListener("mouseup", this.mouseUpHandler);
  }

  private stopDragging() {
    this.dragging = false;
    document.onselectstart = null;
    document.removeEventListener("mousemove", this.mouseMoveHandler);
    document.removeEventListener("mouseup", this.mouseUpHandler);
  }
}
