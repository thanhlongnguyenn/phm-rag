const Bubble = ({message}) => {
    const {content} = message
    return (
        <div className="bubble">{content}</div>
    )
}

export default Bubble;