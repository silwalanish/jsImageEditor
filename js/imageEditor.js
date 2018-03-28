HTMLElement.prototype.addClass = function(className)
{
	let classList = this.className.split(" ");
	if(classList.indexOf(className) == -1)
	{
		this.className += " " + className;
	}
};

HTMLElement.prototype.removeClass = function(className)
{
	let classList = this.className.split(" ");
	this.className = "";
	for (let i = 0; i < classList.length; i++) {
		if(classList[i] != className)
			this.className += " " + classList[i];		
	}
};

HTMLElement.prototype.empty = function()
{
	let firstChild;
	while(firstChild = this.firstChild)
		this.removeChild(firstChild);
};

CanvasRenderingContext2D.prototype.copyFrom = function(ctx)
{
	var imageData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
	this.putImageData(imageData, 0, 0);
}

class Option{

	constructor(app_context, label, icon, onclick_action)
	{
		this.app_context = app_context;
		this.label = label;
		this.icon = icon;
		this.onclick_action = onclick_action;
	}

	onclick()
	{
		this.onclick_action();
	}

}

class Action extends Option{

	constructor(app_context, label, icon, onclick_action)
	{
		super(app_context, label, icon, onclick_action);
	}

	onclick()
	{
		this.app_context.needsChange = true;
		this.app_context.actions.preview_action = this;
		this.apply();
	}

	apply()
	{
		throw new ReferenceError("You must override the Action.apply() function.");
	}

	save(){
		this.app_context.actions.addAction(this);
	}

	set appContext(app_context){
		this.app_context = app_context;
	}

}

class Filter extends Action{

	constructor(label, filter_func, app_context=null)
	{
		super(app_context, label, null, null);
		this.filter_func = filter_func;
		this.preview_canvas = document.createElement('canvas');
	}

	apply(){
		this.filter_func(this.app_context.drawingContext);
	}

	preview(){
		this.preview_canvas.width = this.app_context.canvas.width;
		this.preview_canvas.height = this.app_context.canvas.height;
		this.preview_canvas.getContext('2d').copyFrom(this.app_context.drawingContext);
		this.filter_func(this.preview_canvas.getContext('2d'));
	}

	set appContext(app_context){
		this.app_context = app_context;
	}

}

class NavigationBuilder{

	constructor(app_context){
		this.app_context = app_context;
		this.navigations = [
			{
				title: "Image",
				options: [
					new Option(this.app_context, "Open Image", "open.png", function(){
						document.querySelector("#imageEditor__imageSelector").click();
					}),
					new Option(this.app_context, "Save Image", "save.png", function(){
						alert("Do you wnat to save?");
					}),
				]
			},
			{
				title: "Filters",
				options: []
			},
			{
				title: "Transform",
				options: []
			},
			{
				title: "Adjust",
				options: []
			},
		];	
	}

	init()
	{
		let navigationBar = document.createElement("div");
		navigationBar.className = "navigation-bar";
		let tabs = document.createElement("ul");
		tabs.className = "navigation-bar__navigation";
		let li, textNode;
		let that = this;
		for (let i = 0; i < this.navigations.length; i++) {
			li = document.createElement("li");
			textNode = document.createTextNode(this.navigations[i].title);
			li.appendChild(textNode);
			li.className = "navigation-bar__navigation-item";
			li.dataset.id = i;
			li.addEventListener('click', function(e){
				that.onOptionMenuClicked(e);
			});
			tabs.appendChild(li);
		}

		navigationBar.appendChild(tabs);

		let options = document.createElement("div");
		options.className = "options";

		navigationBar.appendChild(options);

		document.querySelector(".editor").appendChild(navigationBar);

		tabs.firstChild.addClass("active");
		tabs.firstChild.click();
	}

	onOptionMenuClicked(e)
	{
		this.app_context.needsChange = false;
		let index = e.target.dataset.id;
		let options = this.navigations[index].options;
		if(options)
		{
			let options_cont = document.querySelector(".editor .navigation-bar .options");
			options_cont.empty();
			let div, img, label, canvas;
			for (let i = 0; i < options.length; i++) {
				let option = options[i];
				div = document.createElement("div");
				div.className = "options-item";

				label = document.createElement("label");
				label.className = "options-item--label";
				label.appendChild(document.createTextNode(option.label));
				div.appendChild(label);

				if(option.icon){
					img = document.createElement("img");
					img.className = "options-item--img";
					img.src = "icons/"+option.icon;
					div.appendChild(img);
				}

				if(option instanceof Filter){
					canvas = option.preview_canvas;
					canvas.className = "options-item--preview";
					option.preview();
					div.appendChild(canvas);
				}

				options_cont.appendChild(div);	
				div.addEventListener("click", function(){
					option.onclick();
				});
			}
		}

		document.querySelector(".editor .navigation-bar .navigation-bar__navigation-item.active").removeClass("active");

		e.target.addClass("active");
	}

	addFilter(filter){
		filter.appContext = this.app_context;
		this.navigations[1].options.push(filter);
	}

}

class ActionManager{

	constructor(app_context){
		this.app_context = app_context;
		this.actions = [];
		this.preview_action = null;
	}

	addAction(action){
		if(!(action instanceof Action)) throw new TypeError("action must be of Action type.");
		this.actions.push(action);
	}

	applyActions(){
		for (let i = 0; i < this.actions.length; i++) {
			this.actions[i].apply(this.app_context.drawingContext);
		}
		if(this.preview_action)
			this.preview_action.apply(this.app_context.drawingContext);
	}

	set previewAction(preview_action){
		this.preview_action = preview_action;
	}

	undo(){
		this.actions.pop();
	}

}

class Application{

	constructor(){
		this.canvas = document.querySelector(".editor .editor__canvas");
		this.drawingContext = this.canvas.getContext('2d');
		this.currentImage = null;
		this.actions = new ActionManager(this);
		this.navigations = new NavigationBuilder(this);
		this.needsChange = false;

		this.init();
	}

	init()
	{
		let fileInput = document.createElement("input");
		fileInput.type = "file";
		fileInput.id = "imageEditor__imageSelector";
		fileInput.hidden = true;
		document.querySelector(".editor").appendChild(fileInput);
		let that = this;
		fileInput.addEventListener("change", function(){ that.openFile();});

		this.navigations.init();

		this.mainloop();
	}

	clearCanvas()
	{
		this.drawingContext.clearRect(0, 0, this.canvas.width, this.canvas.height);
	}

	drawCurrentImage()
	{
		this.canvas.width = this.currentImage.naturalWidth;
		this.canvas.height = this.currentImage.naturalHeight;
		this.drawingContext.drawImage(this.currentImage, 0, 0);
	}

	mainloop()
	{
		let that = this;

		if(this.needsChange){

			this.clearCanvas();

			if(this.currentImage)
				this.drawCurrentImage();

			this.actions.applyActions();

			this.needsChange = false;
		}

		window.requestAnimationFrame(function(){
			that.mainloop();
		});
	}

	registerFilter(filter)
	{
		if(!(filter instanceof Filter)) throw new TypeError("filter must be a instance of Filter.");
		this.navigations.addFilter(filter);
	}

	openFile()
	{
		let fr = new FileReader();
		let fileInput = document.querySelector("#imageEditor__imageSelector");
		let that = this;
		fr.onload = function(){
			let image = new Image(200, 200);
			image.onload = function(){
				that.currentImage = this;
				that.drawCurrentImage();
			};
			image.src = fr.result;
		};
		fr.readAsDataURL(fileInput.files[0]);
	}

}