var socket = io.connect('http://localhost');

$(function(){
	$(".chat-widget").hide();
	$("#join-chat").click(function(){
		$("#join-chat").hide();
		$(".chat-widget").show();
		//触发joined事件，数据由服务端自己抓取，无需传递。
		socket.emit("joined", {});				
	});
	/*	
	//监听chat事件，将返回数据追加到textarea。
	socket.on('chat', function (data) {
		$('#textarea').prepend(data.message);
	});
	*/
	//监听chat事件，将返回数据追加到textarea，同时更新在线用户图标。
	socket.on("chat", function(data){
		$("textarea").append(data.message);
		if(data.username){ 
			$('#users').append('<span class="label label-success" id="username-' + data.username + '">' + data.username + '</span>');
		}
		if(data.users){
			var userHtml = "";
			for(var i=0; i<data.users.length; i++){
				//为每个标签添加ID，方便下线时删除标签。
				userHtml += '<span class="label label-success" id="username-' + data.users[i] + '">'+ data.users[i] + '</span>';
			}
			$("#users").html(userHtml);
		}
	});

	$("#send-chat").click(function(){
		//触发clientchat方法，将textarea中输入的信息传递给服务端。
		socket.emit("clientchat", { message: $("#input01").val() });
	});

	socket.on('disconnect', function(data){
		//移除下线用户标签
		$("#username-"+data.username).remove();
	})

});